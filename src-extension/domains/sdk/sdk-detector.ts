import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as vscode from "vscode";
import { ToolItem, ToolchainStatus } from "./types";

export class SdkDetector {
  async scanToolchain(): Promise<ToolchainStatus> {
    const config = vscode.workspace.getConfiguration("elmasStudio.sdkPaths");
    const customAndroid = config.get<string>("androidSdk");
    const customFlutter = config.get<string>("flutterSdk");
    const customJava = config.get<string>("javaHome");
    const customAdb = config.get<string>("adbPath");

    const tools: ToolItem[] = [];

    // 1. Node.js, npm, pnpm
    tools.push(this.detectCliTool("node", "Node.js", ["--version"], ["React Web", "React Native"]));
    tools.push(this.detectCliTool("npm", "npm", ["--version"], ["React Web", "React Native"]));
    tools.push(this.detectCliTool("pnpm", "pnpm", ["--version"], ["React Web", "React Native"]));

    // 2. Flutter & Dart
    const flutterTool = this.detectFlutter(customFlutter);
    tools.push(flutterTool);
    tools.push(this.detectCliTool("dart", "Dart", ["--version"], ["Flutter"]));

    // 3. Java & Gradle
    tools.push(this.detectJava(customJava));
    tools.push(this.detectCliTool("gradle", "Gradle", ["-v"], ["Kotlin / Android"]));

    // 4. Android SDK & ADB
    const { androidSdkPath, adbTool } = this.detectAndroidSdkAndAdb(customAndroid, customAdb);
    tools.push(adbTool);

    return {
      tools,
      androidSdkPath,
      flutterSdkPath: flutterTool.path,
      javaHome: customJava || process.env.JAVA_HOME || null,
    };
  }

  private detectCliTool(bin: string, displayName: string, args: string[], requiredFor: string[]): ToolItem {
    const binPath = this.resolveExecutablePath(bin);
    if (!binPath) {
      return {
        name: displayName,
        installed: false,
        version: null,
        path: null,
        requiredFor,
      };
    }

    const version = this.runCommandForVersion(binPath, args);
    return {
      name: displayName,
      installed: true,
      version,
      path: binPath,
      requiredFor,
    };
  }

  private detectFlutter(customFlutter?: string): ToolItem {
    let resolvedPath: string | null = null;

    if (customFlutter && fs.existsSync(customFlutter)) {
      const bat = path.join(customFlutter, "bin", process.platform === "win32" ? "flutter.bat" : "flutter");
      resolvedPath = fs.existsSync(bat) ? bat : customFlutter;
    }

    if (!resolvedPath) {
      resolvedPath = this.resolveExecutablePath("flutter");
    }

    if (!resolvedPath && process.env.USERPROFILE) {
      const candidate = path.join(process.env.USERPROFILE, "Documents", "Flutter SDK", "flutter", "bin", "flutter.bat");
      if (fs.existsSync(candidate)) resolvedPath = candidate;
    }

    const version = resolvedPath ? this.runCommandForVersion(resolvedPath, ["--version"]) : null;

    return {
      name: "Flutter",
      installed: Boolean(resolvedPath),
      version,
      path: resolvedPath,
      requiredFor: ["Flutter"],
    };
  }

  private detectJava(customJava?: string): ToolItem {
    let resolvedPath: string | null = null;

    if (customJava && fs.existsSync(customJava)) {
      const javaExe = path.join(customJava, "bin", process.platform === "win32" ? "java.exe" : "java");
      if (fs.existsSync(javaExe)) resolvedPath = javaExe;
    }

    if (!resolvedPath) {
      resolvedPath = this.resolveExecutablePath("java");
    }

    const version = resolvedPath ? this.runCommandForVersion(resolvedPath, ["-version"]) : null;

    return {
      name: "Java JDK",
      installed: Boolean(resolvedPath),
      version,
      path: resolvedPath,
      requiredFor: ["Flutter (Android)", "Kotlin / Compose"],
    };
  }

  private detectAndroidSdkAndAdb(customSdk?: string, customAdb?: string): { androidSdkPath: string | null; adbTool: ToolItem } {
    let sdkDir: string | null = null;

    if (customSdk && fs.existsSync(customSdk)) {
      sdkDir = customSdk;
    } else if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
      sdkDir = process.env.ANDROID_HOME;
    } else if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
      sdkDir = process.env.ANDROID_SDK_ROOT;
    } else if (process.env.USERPROFILE) {
      const candidate = path.join(process.env.USERPROFILE, "AppData", "Local", "Android", "Sdk");
      if (fs.existsSync(candidate)) sdkDir = candidate;
    }

    let adbPath = customAdb && fs.existsSync(customAdb) ? customAdb : null;
    if (!adbPath) {
      adbPath = this.resolveExecutablePath("adb");
    }
    if (!adbPath && sdkDir) {
      const candidate = path.join(sdkDir, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
      if (fs.existsSync(candidate)) adbPath = candidate;
    }

    const adbVersion = adbPath ? this.runCommandForVersion(adbPath, ["version"]) : null;

    const adbTool: ToolItem = {
      name: "Android ADB",
      installed: Boolean(adbPath),
      version: adbVersion,
      path: adbPath,
      requiredFor: ["React Native (Native)", "Flutter (Native)", "Kotlin (Native)"],
    };

    return { androidSdkPath: sdkDir, adbTool };
  }

  private resolveExecutablePath(bin: string): string | null {
    try {
      const cmd = process.platform === "win32" ? `where ${bin}` : `which ${bin}`;
      const output = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const firstLine = output.split(/\r?\n/)[0]?.trim();
      return firstLine && fs.existsSync(firstLine) ? firstLine : null;
    } catch {
      return null;
    }
  }

  private runCommandForVersion(bin: string, args: string[]): string | null {
    try {
      const output = execSync(`"${bin}" ${args.join(" ")}`, { stdio: ["ignore", "pipe", "pipe"], timeout: 3000 }).toString();
      const firstLine = output.split(/\r?\n/)[0]?.trim();
      return firstLine || null;
    } catch (e: any) {
      const stderr = e.stderr ? e.stderr.toString() : "";
      const firstLine = stderr.split(/\r?\n/)[0]?.trim();
      return firstLine || null;
    }
  }
}

export const sdkDetector = new SdkDetector();

