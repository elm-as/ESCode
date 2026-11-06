import { invoke } from "@tauri-apps/api/core";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
} from "./types";
import { SupportedFramework } from "../projects/types";

export class FlutterAdapter implements IFrameworkAdapter {
  readonly name = "Flutter";
  readonly framework: SupportedFramework = "flutter";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;
  private currentOptions: AdapterStartOptions | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const res = await invoke<{ framework: string }>("detect_project_type", { projectPath });
    return res.framework === "flutter";
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    const toolchain = await invoke<{ tools: Array<{ name: string; installed: boolean }> }>("sdk_scan");
    const hasFlutter = toolchain.tools.some((t) => t.name === "Flutter" && t.installed);
    if (!hasFlutter) {
      return {
        valid: false,
        reason: "Flutter SDK was not found in PATH or standard installation directory.",
      };
    }

    if (mode === "native") {
      const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
      if (!hasAdb) {
        return {
          valid: false,
          reason: "Android ADB is required for Flutter native preview target.",
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

    const processId = `flutter_${Date.now()}`;
    this.activeProcessId = processId;

    // Fast preview targets web-server; Native mode targets Android device/emulator
    const command =
      options.mode === "fast"
        ? `flutter run -d web-server --web-port=${options.port} --web-hostname=127.0.0.1`
        : `flutter run -d android`;

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
      throw new Error(`Failed to start Flutter engine: ${errMsg}`);
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
    // Flutter hot reload trigger can be sent through stdin or process signaling
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
      supportsElementInspection: true,
      targetPlatform: "Flutter Engine (CanvasKit / Skia)",
    };
  }
}

