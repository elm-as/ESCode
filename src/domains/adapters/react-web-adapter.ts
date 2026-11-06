import { invoke } from "@tauri-apps/api/core";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
} from "./types";
import { SupportedFramework } from "../projects/types";

export class ReactWebAdapter implements IFrameworkAdapter {
  readonly name = "React Web";
  readonly framework: SupportedFramework = "react_web";

  private currentStatus: AdapterStatus = {
    state: "idle",
    mode: "fast",
  };
  private activeProcessId: string | null = null;
  private currentOptions: AdapterStartOptions | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const res = await invoke<{ framework: string }>("detect_project_type", { projectPath });
    return res.framework === "react_web";
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "native") {
      return {
        valid: false,
        reason: "React Web projects run in browser and WebView environments. For native Android APK, use React Native / Expo.",
      };
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentOptions = options;
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };

    const processId = `react_web_${Date.now()}`;
    this.activeProcessId = processId;

    // Vite development server with explicit port and host
    const command = `pnpm dev --port ${options.port} --host 127.0.0.1`;

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
      throw new Error(`Failed to start Vite dev server: ${errMsg}`);
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
    // Vite handles HMR automatically through WebSocket.
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
      supportsNativePreview: false,
      supportsHmr: true,
      supportsHotRestart: true,
      supportsElementInspection: true,
      targetPlatform: "Web / WebView",
    };
  }
}
