"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VanillaWebAdapter = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MIME_MAP = {
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
class VanillaWebAdapter {
    name = "Vanilla Web (HTML/CSS/JS/Wasm)";
    framework = "vanilla_web";
    currentStatus = { state: "idle", mode: "fast" };
    server = null;
    sseClients = [];
    activePort = 0;
    async detectProject(projectPath) {
        const hasIndexHtml = fs.existsSync(path.join(projectPath, "index.html"));
        const hasPublicIndex = fs.existsSync(path.join(projectPath, "public", "index.html"));
        if (!hasIndexHtml && !hasPublicIndex) {
            return false;
        }
        // Guard: if it has react, vite, flutter, or gradle, let dedicated adapters handle it
        const pkgPath = path.join(projectPath, "package.json");
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = fs.readFileSync(pkgPath, "utf-8").toLowerCase();
                if (pkg.includes('"react"') || pkg.includes('"vue"') || pkg.includes('"vite"')) {
                    return false;
                }
            }
            catch {
                // Ignored
            }
        }
        return true;
    }
    async validateEnvironment(mode) {
        if (mode === "native") {
            return {
                valid: false,
                reason: "Vanilla HTML/CSS/JS runs directly in Web targets. For native Android APK, use React Native, Flutter or Compose.",
            };
        }
        return { valid: true };
    }
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
        this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
        this.activePort = options.port;
        await this.stop();
        return new Promise((resolve, reject) => {
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
    async stop() {
        if (this.server) {
            for (const client of this.sseClients) {
                try {
                    client.end();
                }
                catch { }
            }
            this.sseClients = [];
            await new Promise((resolve) => {
                this.server?.close(() => resolve());
                this.server = null;
            });
        }
        this.currentStatus = { state: "stopped", mode: "fast" };
    }
    async reload() {
        for (const client of this.sseClients) {
            try {
                client.write("data: reload\n\n");
            }
            catch {
                // Disconnected client
            }
        }
    }
    getStatus() {
        return this.currentStatus;
    }
    getCapabilities() {
        return {
            supportsFastPreview: true,
            supportsNativePreview: false,
            supportsHmr: true,
            supportsHotRestart: true,
            supportsElementInspection: false,
            targetPlatform: "web",
        };
    }
    handleHttpRequest(rootPath, req, res) {
        const rawUrl = req.url || "/";
        // Handle SSE Live Reload channel
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
        // Prevent directory traversal
        if (!filePath.startsWith(rootPath)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }
        // Directory fallback to index.html
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
                let content = fs.readFileSync(filePath, "utf-8");
                if (content.includes("</body>")) {
                    content = content.replace("</body>", `${LIVE_RELOAD_SNIPPET}</body>`);
                }
                else {
                    content += LIVE_RELOAD_SNIPPET;
                }
                res.writeHead(200, { "Content-Type": mime });
                res.end(content);
                return;
            }
            const stream = fs.createReadStream(filePath);
            res.writeHead(200, { "Content-Type": mime });
            stream.pipe(res);
        }
        catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Server error reading file");
        }
    }
}
exports.VanillaWebAdapter = VanillaWebAdapter;
//# sourceMappingURL=vanilla-web-adapter.js.map