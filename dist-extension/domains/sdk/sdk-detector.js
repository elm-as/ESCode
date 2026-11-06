"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdkDetector = exports.SdkDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
class SdkDetector {
    async scanToolchain() {
        const config = vscode.workspace.getConfiguration("elmasStudio.sdkPaths");
        const customAndroid = config.get("androidSdk");
        const customFlutter = config.get("flutterSdk");
        const customJava = config.get("javaHome");
        const customAdb = config.get("adbPath");
        const tools = [];
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
    detectCliTool(bin, displayName, args, requiredFor) {
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
    detectFlutter(customFlutter) {
        let resolvedPath = null;
        if (customFlutter && fs.existsSync(customFlutter)) {
            const bat = path.join(customFlutter, "bin", process.platform === "win32" ? "flutter.bat" : "flutter");
            resolvedPath = fs.existsSync(bat) ? bat : customFlutter;
        }
        if (!resolvedPath) {
            resolvedPath = this.resolveExecutablePath("flutter");
        }
        if (!resolvedPath && process.env.USERPROFILE) {
            const candidate = path.join(process.env.USERPROFILE, "Documents", "Flutter SDK", "flutter", "bin", "flutter.bat");
            if (fs.existsSync(candidate))
                resolvedPath = candidate;
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
    detectJava(customJava) {
        let resolvedPath = null;
        if (customJava && fs.existsSync(customJava)) {
            const javaExe = path.join(customJava, "bin", process.platform === "win32" ? "java.exe" : "java");
            if (fs.existsSync(javaExe))
                resolvedPath = javaExe;
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
    detectAndroidSdkAndAdb(customSdk, customAdb) {
        let sdkDir = null;
        if (customSdk && fs.existsSync(customSdk)) {
            sdkDir = customSdk;
        }
        else if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
            sdkDir = process.env.ANDROID_HOME;
        }
        else if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
            sdkDir = process.env.ANDROID_SDK_ROOT;
        }
        else if (process.env.USERPROFILE) {
            const candidate = path.join(process.env.USERPROFILE, "AppData", "Local", "Android", "Sdk");
            if (fs.existsSync(candidate))
                sdkDir = candidate;
        }
        let adbPath = customAdb && fs.existsSync(customAdb) ? customAdb : null;
        if (!adbPath) {
            adbPath = this.resolveExecutablePath("adb");
        }
        if (!adbPath && sdkDir) {
            const candidate = path.join(sdkDir, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
            if (fs.existsSync(candidate))
                adbPath = candidate;
        }
        const adbVersion = adbPath ? this.runCommandForVersion(adbPath, ["version"]) : null;
        const adbTool = {
            name: "Android ADB",
            installed: Boolean(adbPath),
            version: adbVersion,
            path: adbPath,
            requiredFor: ["React Native (Native)", "Flutter (Native)", "Kotlin (Native)"],
        };
        return { androidSdkPath: sdkDir, adbTool };
    }
    resolveExecutablePath(bin) {
        try {
            const cmd = process.platform === "win32" ? `where ${bin}` : `which ${bin}`;
            const output = (0, child_process_1.execSync)(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString();
            const firstLine = output.split(/\r?\n/)[0]?.trim();
            return firstLine && fs.existsSync(firstLine) ? firstLine : null;
        }
        catch {
            return null;
        }
    }
    runCommandForVersion(bin, args) {
        try {
            const output = (0, child_process_1.execSync)(`"${bin}" ${args.join(" ")}`, { stdio: ["ignore", "pipe", "pipe"], timeout: 3000 }).toString();
            const firstLine = output.split(/\r?\n/)[0]?.trim();
            return firstLine || null;
        }
        catch (e) {
            const stderr = e.stderr ? e.stderr.toString() : "";
            const firstLine = stderr.split(/\r?\n/)[0]?.trim();
            return firstLine || null;
        }
    }
}
exports.SdkDetector = SdkDetector;
exports.sdkDetector = new SdkDetector();
//# sourceMappingURL=sdk-detector.js.map