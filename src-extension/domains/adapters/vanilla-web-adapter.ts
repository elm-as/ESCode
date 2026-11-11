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
import {
  formatHtmlForMobile,
  MIME_MAP,
  normalizeKey,
} from "./vanilla-web-html";

export class VanillaWebAdapter implements IFrameworkAdapter {
  readonly name = "Vanilla Web (HTML/CSS/JS/Wasm)";
  readonly framework: SupportedFramework = "vanilla_web";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private server: http.Server | null = null;
  private sseClients: http.ServerResponse[] = [];
  private memoryBuffers: Map<string, string> = new Map();

  async detectProject(projectPath: string): Promise<boolean> {
    const hasIndexHtml = fs.existsSync(path.join(projectPath, "index.html"));
    const hasPublicIndex = fs.existsSync(path.join(projectPath, "public", "index.html"));
    if (!hasIndexHtml && !hasPublicIndex) {
      return false;
    }

    const pkgPath = path.join(projectPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = fs.readFileSync(pkgPath, "utf-8").toLowerCase();
        if (pkg.includes('"react"') || pkg.includes('"vue"') || pkg.includes('"vite"')) {
          return false;
        }
      } catch {
        // Ignored
      }
    }

    return true;
  }

  async validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    if (mode === "native") {
      return {
        valid: false,
        reason: "HTML/CSS/JS s'exécute directement en mode Rapide Web.",
      };
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    this.memoryBuffers.clear();

    await this.stop();

    return new Promise<AdapterRunResult>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleHttpRequest(options.projectPath, req, res);
      });

      server.on("error", (err) => {
        this.currentStatus = { state: "error", mode: options.mode, error: err.message };
        reject(err);
      });

      server.listen(options.port, "127.0.0.1", () => {
        this.server = server;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        resolve({
          previewUrl: `http://localhost:${options.port}`,
          port: options.port,
          processId: `vanilla_web_${options.port}`,
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      for (const client of this.sseClients) {
        try { client.end(); } catch {}
      }
      this.sseClients = [];

      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
        this.server = null;
      });
    }
    this.currentStatus = { state: "stopped", mode: "fast" };
  }

  async onDocumentEdited(filePath: string, content: string): Promise<void> {
    this.memoryBuffers.set(normalizeKey(filePath), content);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".html" || ext === ".htm") {
      this.broadcastSse("html-update");
    } else if (ext === ".css") {
      this.broadcastSse("css-update");
    } else {
      this.broadcastSse("reload");
    }
  }

  async reload(): Promise<void> {
    this.broadcastSse("html-update");
  }

  private broadcastSse(eventData: string): void {
    for (const client of this.sseClients) {
      try {
        client.write(`data: ${eventData}\n\n`);
      } catch {
        // Disconnected client
      }
    }
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
      supportsElementInspection: false,
      targetPlatform: "web",
    };
  }

  private handleHttpRequest(
    rootPath: string,
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

    const cleanPath = rawUrl.split("?")[0];
    let filePath = path.join(rootPath, cleanPath === "/" ? "index.html" : cleanPath);

    if (!filePath.startsWith(rootPath)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const memKey = normalizeKey(filePath);
    const hasInMemory = this.memoryBuffers.has(memKey);

    if (!hasInMemory && !fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || "application/octet-stream";

    try {
      if (ext === ".html" || ext === ".htm") {
        const rawContent = hasInMemory
          ? this.memoryBuffers.get(memKey)!
          : fs.readFileSync(filePath, "utf-8");
        const formatted = formatHtmlForMobile(rawContent);
        res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
        res.end(formatted);
        return;
      }

      if (hasInMemory) {
        res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
        res.end(this.memoryBuffers.get(memKey)!);
        return;
      }

      const stream = fs.createReadStream(filePath);
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
      stream.pipe(res);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error reading file");
    }
  }
}
