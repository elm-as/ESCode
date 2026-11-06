import * as fs from "fs";
import * as path from "path";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
  SupportedFramework,
} from "./types";
import { processManager } from "../process/process-manager";
import { sdkDetector } from "../sdk/sdk-detector";

export class KotlinComposeAdapter implements IFrameworkAdapter {
  readonly name = "Kotlin / Jetpack Compose";
  readonly framework: SupportedFramework = "kotlin_compose";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const gradleKts = path.join(projectPath, "build.gradle.kts");
    const gradle = path.join(projectPath, "build.gradle");

    if (fs.existsSync(gradleKts) || fs.existsSync(gradle)) {
      const fileToRead = fs.existsSync(gradleKts) ? gradleKts : gradle;
      try {
        const content = fs.readFileSync(fileToRead, "utf-8").toLowerCase();
        return content.includes("compose") || content.includes("kotlin");
      } catch {
        return false;
      }
    }
    return false;
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    const toolchain = await sdkDetector.scanToolchain();
    const hasJava = toolchain.tools.some((t) => t.name.includes("Java") && t.installed);
    if (!hasJava) {
      return {
        valid: false,
        reason: "Java JDK is required for Kotlin and Jetpack Compose Gradle builds.",
      };
    }

    if (mode === "native") {
      const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
      if (!hasAdb) {
        return {
          valid: false,
          reason: "Android ADB is required for Jetpack Compose native target.",
        };
      }
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    const processId = `kotlin_compose_${Date.now()}`;
    this.activeProcessId = processId;

    const command = "gradle";
    const args = options.mode === "fast" ? ["run"] : ["assembleDebug"];

    try {
      processManager.startProcess({
        id: processId,
        command,
        args,
        cwd: options.projectPath,
      });

      const previewUrl = `http://127.0.0.1:${options.port}`;
      this.currentStatus = { state: "running", mode: options.mode, port: options.port };

      return {
        previewUrl,
        port: options.port,
        processId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.currentStatus = { state: "error", mode: options.mode, error: msg };
      throw new Error(`Failed to start Kotlin Compose tooling: ${msg}`);
    }
  }

  async stop(): Promise<void> {
    if (this.activeProcessId) {
      processManager.stopProcess(this.activeProcessId);
      this.activeProcessId = null;
    }
    this.currentStatus = { state: "stopped", mode: "fast" };
  }

  async reload(): Promise<void> {
    // Gradle build daemon incremental reload
  }

  getStatus(): AdapterStatus {
    return this.currentStatus;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsFastPreview: true,
      supportsNativePreview: true,
      supportsHmr: false,
      supportsHotRestart: true,
      supportsElementInspection: false,
      targetPlatform: "Compose Multiplatform / Android ART",
    };
  }
}

