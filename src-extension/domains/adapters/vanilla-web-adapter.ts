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

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const LIVE_RELOAD_SNIPPET = `
<script id="__elmas_reload">
  (() => {
    try {
      const es = new EventSource('/__elmas_live_reload');
      es.onmessage = (e) => {
        if (e.data === 'reload') window.location.reload();
      };
    } catch {}
  })();
</script>
`;

function formatHtmlForMobile(rawHtml: string): string {
  const hasHtmlTag = rawHtml.toLowerCase().includes("<html");
  const hasViewport = rawHtml.toLowerCase().includes("name=\"viewport\"");

  if (hasHtmlTag) {
    let result = rawHtml;
    if (!hasViewport && result.includes("<head>")) {
      result = result.replace(
        "<head>",
        "<head>\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\">"
      );
    }
    if (result.includes("</body>")) {
      return result.replace("</body>", `${LIVE_RELOAD_SNIPPET}</body>`);
    }
    return result + LIVE_RELOAD_SNIPPET;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background-color: #ffffff;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    body { padding: 24px 20px; line-height: 1.5; }
    h1, h2, h3, h4, h5, h6 {
      color: #09090b;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-top: 0;
      margin-bottom: 8px;
    }
    h1 { font-size: 26px; }
    h2 { font-size: 20px; }
    h3 { font-size: 17px; }
    p {
      color: #52525b;
      font-size: 15px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    button {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:active { opacity: 0.8; }
    input, textarea, select {
      background: #f4f4f5;
      color: #18181b;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 14px;
      outline: none;
      width: 100%;
    }
    input:focus, textarea:focus, select:focus { border-color: #0284c7; }
  </style>
</head>
<body>
  ${rawHtml}
  ${LIVE_RELOAD_SNIPPET}
</body>
</html>`;
}

export class VanillaWebAdapter implements IFrameworkAdapter {
  readonly name = "Vanilla Web (HTML/CSS/JS/Wasm)";
  readonly framework: SupportedFramework = "vanilla_web";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private server: http.Server | null = null;
  private sseClients: http.ServerResponse[] = [];
  private activePort: number = 0;

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
        reason: "Vanilla HTML/CSS/JS runs directly in Web targets. For native Android APK, use React Native, Flutter or Compose.",
      };
    }
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
    this.activePort = options.port;

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

  async reload(): Promise<void> {
    for (const client of this.sseClients) {
      try {
        client.write("data: reload\n\n");
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

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || "application/octet-stream";

    try {
      if (ext === ".html" || ext === ".htm") {
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const formatted = formatHtmlForMobile(rawContent);
        res.writeHead(200, { "Content-Type": mime });
        res.end(formatted);
        return;
      }

      const stream = fs.createReadStream(filePath);
      res.writeHead(200, { "Content-Type": mime });
      stream.pipe(res);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error reading file");
    }
  }
}
