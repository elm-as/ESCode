import * as http from "http";
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
import {
  parseFlutterSource,
  renderFlutterPreviewDocument,
} from "./flutter-live-compiler";

export class FlutterAdapter implements IFrameworkAdapter {
  readonly name = "Flutter";
  readonly framework: SupportedFramework = "flutter";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;
  private activeAppId: string | null = null;
  private restartRequestId: number = 1;
  private fastServer: http.Server | null = null;
  private sseClients: http.ServerResponse[] = [];
  private projectPath: string = "";
  private memoryDartBuffer: string | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const pubspec = path.join(projectPath, "pubspec.yaml");
    return fs.existsSync(pubspec);
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "fast") {
      return { valid: true };
    }

    const toolchain = await sdkDetector.scanToolchain();
    const hasFlutter = toolchain.tools.some((t) => t.name === "Flutter" && t.installed);
    if (!hasFlutter) {
      return {
        valid: false,
        reason: "Flutter SDK non détecté dans le PATH.",
      };
    }

    const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
    if (!hasAdb) {
      return {
        valid: false,
        reason: "Android ADB est requis pour le mode natif Flutter.",
      };
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    this.projectPath = options.projectPath;
    this.memoryDartBuffer = null;

    await this.stop();

    if (options.mode === "fast") {
      return this.startFastLiveServer(options);
    }

    return this.startNativeAndroidRunner(options);
  }

  private startFastLiveServer(options: AdapterStartOptions): Promise<AdapterRunResult> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleFastHttpRequest(req, res);
      });

      server.on("error", (err) => {
        this.currentStatus = { state: "error", mode: options.mode, error: err.message };
        reject(err);
      });

      server.listen(options.port, "127.0.0.1", () => {
        this.fastServer = server;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        resolve({
          previewUrl: `http://127.0.0.1:${options.port}`,
          port: options.port,
          processId: `flutter_fast_${options.port}`,
        });
      });
    });
  }

  private startNativeAndroidRunner(options: AdapterStartOptions): AdapterRunResult {
    const processId = `flutter_native_${Date.now()}`;
    this.activeProcessId = processId;
    this.activeAppId = null;

    processManager.startProcess({
      id: processId,
      command: "flutter",
      args: ["run", "--machine", "-d", "android"],
      cwd: options.projectPath,
      onStdout: (line: string) => this.handleMachineStdout(line),
    });

    const previewUrl = `http://127.0.0.1:${options.port}`;
    this.currentStatus = { state: "running", mode: options.mode, port: options.port };

    return {
      previewUrl,
      port: options.port,
      processId,
    };
  }

  private handleMachineStdout(line: string): void {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[{")) return;

    try {
      const events = JSON.parse(trimmed);
      for (const evt of events) {
        if (evt.event === "app.start" && evt.params?.appId) {
          this.activeAppId = evt.params.appId;
        }
      }
    } catch {
      // Non-JSON stdout line
    }
  }

  private readCurrentDartSource(): string {
    if (this.memoryDartBuffer !== null) {
      return this.memoryDartBuffer;
    }
    const mainDartPath = path.join(this.projectPath, "lib", "main.dart");
    if (fs.existsSync(mainDartPath)) {
      try {
        return fs.readFileSync(mainDartPath, "utf-8");
      } catch {
        return "";
      }
    }
    return "";
  }

  private handleFastHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const rawUrl = req.url || "/";

    if (rawUrl === "/__elmas_live_reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write("data: connected\n\n");
      this.sseClients.push(res);
      req.on("close", () => {
        this.sseClients = this.sseClients.filter((c) => c !== res);
      });
      return;
    }

    const source = this.readCurrentDartSource();
    const parsed = parseFlutterSource(source);
    const html = renderFlutterPreviewDocument(parsed);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  }

  async onDocumentEdited(filePath: string, content: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith(".dart")) {
      return;
    }
    this.memoryDartBuffer = content;
    this.broadcastLivePatch(content);
  }

  async reload(): Promise<void> {
    const source = this.readCurrentDartSource();
    this.broadcastLivePatch(source);

    if (this.activeProcessId) {
      if (this.activeAppId) {
        const rpc = JSON.stringify([
          {
            method: "app.restart",
            id: this.restartRequestId++,
            params: { appId: this.activeAppId, fullRestart: false },
          },
        ]);
        processManager.writeStdin(this.activeProcessId, `${rpc}\n`);
      } else {
        processManager.writeStdin(this.activeProcessId, "r\n");
      }
    }
  }

  private broadcastLivePatch(dartSource: string): void {
    if (this.sseClients.length === 0) return;

    const parsed = parseFlutterSource(dartSource);
    const message = JSON.stringify({ type: "flutter-patch", payload: parsed });

    for (const client of this.sseClients) {
      try {
        client.write(`data: ${message}\n\n`);
      } catch {
        // Ignore closed socket
      }
    }
  }

  async stop(): Promise<void> {
    if (this.fastServer) {
      for (const client of this.sseClients) {
        try { client.end(); } catch {}
      }
      this.sseClients = [];
      await new Promise<void>((resolve) => {
        this.fastServer?.close(() => resolve());
        this.fastServer = null;
      });
    }

    if (this.activeProcessId) {
      processManager.stopProcess(this.activeProcessId);
      this.activeProcessId = null;
      this.activeAppId = null;
    }

    this.currentStatus = { state: "stopped", mode: "fast" };
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
      targetPlatform: "Flutter Engine (Live Hot-Swap / Android ART)",
    };
  }
}
