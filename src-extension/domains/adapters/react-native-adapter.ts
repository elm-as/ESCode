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

export class ReactNativeAdapter implements IFrameworkAdapter {
  readonly name = "React Native";
  readonly framework: SupportedFramework = "react_native";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const pkgPath = path.join(projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) return false;

    try {
      const content = fs.readFileSync(pkgPath, "utf-8").toLowerCase();
      return content.includes('"react-native"') || content.includes('"expo"');
    } catch {
      return false;
    }
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "native") {
      const toolchain = await sdkDetector.scanToolchain();
      const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
      if (!hasAdb) {
        return {
          valid: false,
          reason: "Android ADB is required for React Native native preview. Configure ADB path in SDK settings.",
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
    const processId = `react_native_${Date.now()}`;
    this.activeProcessId = processId;

    const command = "npx";
    const args =
      options.mode === "fast"
        ? ["expo", "start", "--web", "--port", String(options.port)]
        : ["expo", "start", "--android", "--port", String(options.port)];

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
      throw new Error(`Failed to start React Native runner: ${msg}`);
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
    // Metro bundler handles HMR / Fast Refresh automatically.
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

