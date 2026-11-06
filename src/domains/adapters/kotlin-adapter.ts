import { invoke } from "@tauri-apps/api/core";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
} from "./types";
import { SupportedFramework } from "../projects/types";

export class KotlinComposeAdapter implements IFrameworkAdapter {
  readonly name = "Kotlin / Jetpack Compose";
  readonly framework: SupportedFramework = "kotlin_compose";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;
  private currentOptions: AdapterStartOptions | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const res = await invoke<{ framework: string }>("detect_project_type", { projectPath });
    return res.framework === "kotlin_compose";
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    const toolchain = await invoke<{ tools: Array<{ name: string; installed: boolean }> }>("sdk_scan");
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
    this.currentOptions = options;
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };

    const processId = `kotlin_compose_${Date.now()}`;
    this.activeProcessId = processId;

    // Fast preview runs Compose Multiplatform Desktop; Native runs Android Gradle target
    const command = options.mode === "fast" ? "gradle run" : "gradle assembleDebug";

    try {
      await invoke("process_start", {
        id: processId,
        commandLine: command,
        workingDir: options.projectPath,
        port: options.port,
      });

      // Compose desktop preview runs as native standalone surface or web-socket bridge
      const previewUrl = `http://127.0.0.1:${options.port}`;
      this.currentStatus = { state: "running", mode: options.mode, port: options.port };

      return {
        previewUrl,
        port: options.port,
        processId,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.currentStatus = { state: "error", mode: options.mode, error: errMsg };
      throw new Error(`Failed to start Kotlin/Compose tooling: ${errMsg}`);
    }
  }

  async stop(): Promise<void> {
    if (this.activeProcessId) {
      await invoke("process_stop", { id: this.activeProcessId });
      this.activeProcessId = null;
    }
    this.currentStatus = { state: "stopped", mode: "fast" };
  }

  async reload(): Promise<void> {
    // Gradle build daemon incremental reload
  }

  async restart(): Promise<void> {
    if (!this.currentOptions) return;
    await this.stop();
    await this.start(this.currentOptions);
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
