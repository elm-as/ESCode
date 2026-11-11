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
const vanilla_web_html_1 = require("./vanilla-web-html");
class VanillaWebAdapter {
    name = "Vanilla Web (HTML/CSS/JS/Wasm)";
    framework = "vanilla_web";
    currentStatus = { state: "idle", mode: "fast" };
    server = null;
    sseClients = [];
    memoryBuffers = new Map();
    async detectProject(projectPath) {
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
                reason: "HTML/CSS/JS s'exécute directement en mode Rapide Web.",
            };
        }
        return { valid: true };
    }
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
        this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
        this.memoryBuffers.clear();
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
    async onDocumentEdited(filePath, content) {
        this.memoryBuffers.set((0, vanilla_web_html_1.normalizeKey)(filePath), content);
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".html" || ext === ".htm") {
            this.broadcastSse("html-update");
        }
        else if (ext === ".css") {
            this.broadcastSse("css-update");
        }
        else {
            this.broadcastSse("reload");
        }
    }
    async reload() {
        this.broadcastSse("html-update");
    }
    broadcastSse(eventData) {
        for (const client of this.sseClients) {
            try {
                client.write(`data: ${eventData}\n\n`);
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
        const memKey = (0, vanilla_web_html_1.normalizeKey)(filePath);
        const hasInMemory = this.memoryBuffers.has(memKey);
        if (!hasInMemory && !fs.existsSync(filePath)) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = vanilla_web_html_1.MIME_MAP[ext] || "application/octet-stream";
        try {
            if (ext === ".html" || ext === ".htm") {
                const rawContent = hasInMemory
                    ? this.memoryBuffers.get(memKey)
                    : fs.readFileSync(filePath, "utf-8");
                const formatted = (0, vanilla_web_html_1.formatHtmlForMobile)(rawContent);
                res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
                res.end(formatted);
                return;
            }
            if (hasInMemory) {
                res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
                res.end(this.memoryBuffers.get(memKey));
                return;
            }
            const stream = fs.createReadStream(filePath);
            res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
            stream.pipe(res);
        }
        catch {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Server error reading file");
        }
    }
}
exports.VanillaWebAdapter = VanillaWebAdapter;
//# sourceMappingURL=vanilla-web-adapter.js.map