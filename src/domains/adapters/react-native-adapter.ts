import { invoke } from "@tauri-apps/api/core";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
} from "./types";
import { SupportedFramework } from "../projects/types";

export class ReactNativeAdapter implements IFrameworkAdapter {
  readonly name = "React Native";
  readonly framework: SupportedFramework = "react_native";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;
  private currentOptions: AdapterStartOptions | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const res = await invoke<{ framework: string }>("detect_project_type", { projectPath });
    return res.framework === "react_native";
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "native") {
      const toolchain = await invoke<{ tools: Array<{ name: string; installed: boolean }> }>("sdk_scan");
      const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
      if (!hasAdb) {
        return {
          valid: false,
          reason: "Android ADB was not detected in system PATH or Android SDK platform-tools. Please configure ADB in the SDK Manager.",
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

    const processId = `react_native_${Date.now()}`;
    this.activeProcessId = processId;

    // Fast preview runs Expo Web; Native mode launches Metro + Android
    const command =
      options.mode === "fast"
        ? `npx expo start --web --port ${options.port}`
        : `npx expo start --android --port ${options.port}`;

    try {
      await invoke("process_start", {
        id: processId,
        commandLine: command,
        workingDir: options.projectPath,
        port: options.port,
      });

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
      throw new Error(`Failed to start React Native runner: ${errMsg}`);
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
    // Metro bundler handles HMR/Fast Refresh automatically
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
      supportsHmr: true,
      supportsHotRestart: true,
      supportsElementInspection: true,
      targetPlatform: "React Native / Expo",
    };
  }
}

