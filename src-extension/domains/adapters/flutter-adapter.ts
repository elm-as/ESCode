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
import { scanFlutterWorkspace } from "./flutter-project-scanner";
import { compileFlutterWorkspace } from "./flutter-live-compiler";
import { renderFlutterPreviewDocument } from "./flutter-preview-html";

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
  private memoryBuffers: Map<string, string> = new Map();
  private preferredScreen: string | null = null;

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
    this.memoryBuffers.clear();
    this.preferredScreen = null;

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

    if (rawUrl.startsWith("/__switch_screen")) {
      const urlObj = new URL(rawUrl, "http://127.0.0.1");
      const id = urlObj.searchParams.get("id");
      if (id) {
        this.preferredScreen = id;
        this.broadcastLivePatch();
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (rawUrl.startsWith("/__asset/")) {
      const relAsset = decodeURIComponent(rawUrl.slice("/__asset/".length).split("?")[0]);
      const fullAsset = path.join(this.projectPath, relAsset);
      if (fullAsset.startsWith(this.projectPath) && fs.existsSync(fullAsset)) {
        const ext = path.extname(fullAsset).toLowerCase();
        const mime =
          ext === ".png" ? "image/png" :
          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
          ext === ".svg" ? "image/svg+xml" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        fs.createReadStream(fullAsset).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end();
      return;
    }

    const snapshot = scanFlutterWorkspace(this.projectPath, this.memoryBuffers, this.preferredScreen);
    const compiled = compileFlutterWorkspace(snapshot);
    const html = renderFlutterPreviewDocument(compiled);

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
    const normPath = path.resolve(filePath).toLowerCase();
    this.memoryBuffers.set(normPath, content);

    if (content.includes("Scaffold(") || content.includes("SliverAppBar(")) {
      this.preferredScreen = normPath;
    }
    this.broadcastLivePatch();
  }

  async reload(): Promise<void> {
    this.broadcastLivePatch();

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

  private broadcastLivePatch(): void {
    if (this.sseClients.length === 0) return;

    const snapshot = scanFlutterWorkspace(this.projectPath, this.memoryBuffers, this.preferredScreen);
    const compiled = compileFlutterWorkspace(snapshot);
    const message = JSON.stringify({ type: "flutter-patch", payload: compiled });

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
      targetPlatform: "Flutter Engine (Live Multi-Screen Hot-Swap / Android ART)",
    };
  }
}
