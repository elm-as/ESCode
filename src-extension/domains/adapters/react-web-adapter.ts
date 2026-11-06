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

export class ReactWebAdapter implements IFrameworkAdapter {
  readonly name = "React Web";
  readonly framework: SupportedFramework = "react_web";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const pkgPath = path.join(projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) return false;

    try {
      const content = fs.readFileSync(pkgPath, "utf-8").toLowerCase();
      const hasReactOrVite = content.includes('"react"') || content.includes('"vite"');
      const isReactNative = content.includes('"react-native"') || content.includes('"expo"');
      return hasReactOrVite && !isReactNative;
    } catch {
      return false;
    }
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "native") {
      return {
        valid: false,
        reason: "React Web targets browsers and WebViews. For native Android APK, use React Native / Expo.",
      };
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    const processId = `react_web_${Date.now()}`;
    this.activeProcessId = processId;

    const command = "npx";
    const args = ["vite", "--port", String(options.port), "--host", "127.0.0.1", "--strictPort"];

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
      throw new Error(`Failed to start Vite dev server: ${msg}`);
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
    // Vite handles HMR automatically through WebSocket.
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

