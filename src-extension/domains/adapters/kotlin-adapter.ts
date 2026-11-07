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
  parseKotlinComposeSource,
  renderKotlinComposeDocument,
} from "./kotlin-live-compiler";

export class KotlinComposeAdapter implements IFrameworkAdapter {
  readonly name = "Kotlin / Jetpack Compose";
  readonly framework: SupportedFramework = "kotlin_compose";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private activeProcessId: string | null = null;
  private fastServer: http.Server | null = null;
  private sseClients: http.ServerResponse[] = [];
  private projectPath: string = "";
  private memoryKtBuffer: string | null = null;

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
    if (mode === "fast") {
      return { valid: true };
    }

    const toolchain = await sdkDetector.scanToolchain();
    const hasJava = toolchain.tools.some((t) => t.name.includes("Java") && t.installed);
    if (!hasJava) {
      return {
        valid: false,
        reason: "Java JDK est requis pour les builds Gradle Kotlin / Jetpack Compose.",
      };
    }

    const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
    if (!hasAdb) {
      return {
        valid: false,
        reason: "Android ADB est requis pour le mode natif Jetpack Compose.",
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
    this.memoryKtBuffer = null;

    await this.stop();

    if (options.mode === "fast") {
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
            processId: `kotlin_fast_${options.port}`,
          });
        });
      });
    }

    const processId = `kotlin_compose_${Date.now()}`;
    this.activeProcessId = processId;
    processManager.startProcess({
      id: processId,
      command: "gradle",
      args: ["assembleDebug"],
      cwd: options.projectPath,
    });

    const previewUrl = `http://127.0.0.1:${options.port}`;
    this.currentStatus = { state: "running", mode: options.mode, port: options.port };
    return { previewUrl, port: options.port, processId };
  }

  private readCurrentKotlinSource(): string {
    if (this.memoryKtBuffer !== null) {
      return this.memoryKtBuffer;
    }
    const mainKt = path.join(this.projectPath, "src", "main", "kotlin", "Main.kt");
    if (fs.existsSync(mainKt)) {
      try {
        return fs.readFileSync(mainKt, "utf-8");
      } catch {
        return "";
      }
    }
    return "";
  }

  private handleFastHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.url === "/__elmas_live_reload") {
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

    const parsed = parseKotlinComposeSource(this.readCurrentKotlinSource());
    const html = renderKotlinComposeDocument(parsed);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  }

  async onDocumentEdited(filePath: string, content: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith(".kt")) return;
    this.memoryKtBuffer = content;
    this.broadcastPatch(content);
  }

  async reload(): Promise<void> {
    this.broadcastPatch(this.readCurrentKotlinSource());
  }

  private broadcastPatch(ktSource: string): void {
    if (this.sseClients.length === 0) return;
    const parsed = parseKotlinComposeSource(ktSource);
    const msg = JSON.stringify({ type: "compose-patch", payload: parsed });
    for (const client of this.sseClients) {
      try { client.write(`data: ${msg}\n\n`); } catch {}
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
      supportsElementInspection: false,
      targetPlatform: "Compose Multiplatform / Android ART",
    };
  }
}
