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

export class FlutterAdapter implements IFrameworkAdapter {
  readonly name = "Flutter";
  readonly framework: SupportedFramework = "flutter";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const pubspec = path.join(projectPath, "pubspec.yaml");
    return fs.existsSync(pubspec);
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    const toolchain = await sdkDetector.scanToolchain();
    const hasFlutter = toolchain.tools.some((t) => t.name === "Flutter" && t.installed);
    if (!hasFlutter) {
      return {
        valid: false,
        reason: "Flutter SDK was not detected in PATH or Flutter SDK directory.",
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
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    const processId = `flutter_${Date.now()}`;
    this.activeProcessId = processId;

    const command = "flutter";
    const args =
      options.mode === "fast"
        ? ["run", "-d", "web-server", `--web-port=${options.port}`, "--web-hostname=127.0.0.1"]
        : ["run", "-d", "android"];

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
      throw new Error(`Failed to start Flutter engine: ${msg}`);
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
    // Flutter reload triggers via stdin or terminal
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

