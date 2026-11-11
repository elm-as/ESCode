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
exports.PythonCVisualAdapter = void 0;
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const python_c_preview_html_1 = require("./python-c-preview-html");
const python_c_runner_1 = require("./python-c-runner");
class PythonCVisualAdapter {
    name = "Python (Pygame / CLI) & C (ANSI / 9:16)";
    framework = "python_c_visual";
    currentStatus = { state: "idle", mode: "fast" };
    server = null;
    activeChild = null;
    sseClients = [];
    scripts = [];
    activeScript = null;
    latestJpegFrame = null;
    latestAnsiHtml = "Chargement…";
    rootPath = "";
    async detectProject(projectPath) {
        const found = (0, python_c_runner_1.discoverWorkspaceScripts)(projectPath);
        return found.length > 0;
    }
    async validateEnvironment(_mode) {
        return { valid: true };
    }
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
        await this.stop();
        this.rootPath = options.projectPath;
        this.scripts = (0, python_c_runner_1.discoverWorkspaceScripts)(options.projectPath);
        const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
        this.activeScript =
            this.findMatchingScript(activeEditorPath) ||
                this.scripts.find((s) => s.kind === "pygame") ||
                this.scripts[0] ||
                null;
        if (this.activeScript) {
            this.launchScriptProcess(this.activeScript);
        }
        return new Promise((resolve, reject) => {
            const srv = http.createServer((req, res) => this.handleHttp(req, res));
            srv.on("error", (err) => reject(err));
            srv.listen(options.port, "127.0.0.1", () => {
                this.server = srv;
                this.currentStatus = { state: "running", mode: options.mode, port: options.port };
                resolve({
                    previewUrl: `http://localhost:${options.port}`,
                    port: options.port,
                    processId: `python_c_${options.port}`,
                });
            });
        });
    }
    async stop() {
        this.killActiveChild();
        for (const c of this.sseClients) {
            try {
                c.end();
            }
            catch { }
        }
        this.sseClients = [];
        if (this.server) {
            await new Promise((r) => {
                this.server?.close(() => r());
                this.server = null;
            });
        }
        this.currentStatus = { state: "stopped", mode: "fast" };
    }
    async reload() {
        if (this.activeScript) {
            this.launchScriptProcess(this.activeScript);
        }
    }
    async onDocumentEdited(filePath, _content) {
        const matched = this.findMatchingScript(filePath);
        if (!matched) {
            return;
        }
        if (!this.activeScript || matched.fullPath !== this.activeScript.fullPath) {
            this.activeScript = matched;
            this.launchScriptProcess(matched);
            this.broadcastEvent({ type: "switch", relPath: matched.relPath });
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
            targetPlatform: "python-c-9x16",
        };
    }
    findMatchingScript(filePath) {
        if (!filePath)
            return undefined;
        const norm = path.resolve(filePath).toLowerCase();
        const direct = this.scripts.find((s) => path.resolve(s.fullPath).toLowerCase() === norm);
        if (direct)
            return direct;
        const dirNorm = path.dirname(norm);
        return this.scripts.find((s) => path.dirname(path.resolve(s.fullPath).toLowerCase()) === dirNorm);
    }
    killActiveChild() {
        if (this.activeChild) {
            try {
                this.activeChild.kill();
            }
            catch { }
            this.activeChild = null;
        }
    }
    launchScriptProcess(entry) {
        this.killActiveChild();
        this.latestJpegFrame = null;
        this.latestAnsiHtml = `Exécution de ${entry.relPath}…`;
        if (entry.kind === "pygame") {
            this.activeChild = (0, python_c_runner_1.spawnPygameStream)(entry.fullPath, (jpeg) => {
                this.latestJpegFrame = jpeg;
            }, (errText) => {
                this.broadcastEvent({ type: "status", text: errText.slice(0, 60) });
            });
        }
        else {
            this.activeChild = (0, python_c_runner_1.spawnAnsiStream)(entry, (html) => {
                this.latestAnsiHtml = html;
                this.broadcastEvent({ type: "ansi", html });
            });
        }
    }
    broadcastEvent(payload) {
        const msg = `data: ${JSON.stringify(payload)}\n\n`;
        for (const c of this.sseClients) {
            try {
                c.write(msg);
            }
            catch { }
        }
    }
    handleHttp(req, res) {
        const parsed = new URL(req.url || "/", "http://127.0.0.1");
        if (parsed.pathname === "/__elmas_events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            if (this.activeScript && this.activeScript.kind !== "pygame") {
                res.write(`data: ${JSON.stringify({ type: "ansi", html: this.latestAnsiHtml })}\n\n`);
            }
            this.sseClients.push(res);
            req.on("close", () => {
                this.sseClients = this.sseClients.filter((c) => c !== res);
            });
            return;
        }
        if (parsed.pathname === "/__elmas_frame.jpg") {
            if (!this.latestJpegFrame) {
                res.writeHead(204);
                res.end();
                return;
            }
            res.writeHead(200, {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
                "Content-Length": this.latestJpegFrame.length,
            });
            res.end(this.latestJpegFrame);
            return;
        }
        if (parsed.pathname === "/__elmas_select" && req.method === "POST") {
            const rel = parsed.searchParams.get("script");
            const found = this.scripts.find((s) => s.relPath === rel);
            if (found) {
                this.activeScript = found;
                this.launchScriptProcess(found);
            }
            res.writeHead(200);
            res.end("ok");
            return;
        }
        if (parsed.pathname === "/__elmas_key" && req.method === "POST") {
            const k = parsed.searchParams.get("key") || "SPACE";
            try {
                this.activeChild?.stdin?.write(`KEY:${k}\n`);
            }
            catch { }
            res.writeHead(200);
            res.end("ok");
            return;
        }
        if (parsed.pathname === "/__elmas_restart" && req.method === "POST") {
            if (this.activeScript) {
                this.launchScriptProcess(this.activeScript);
            }
            res.writeHead(200);
            res.end("ok");
            return;
        }
        const activeRel = this.activeScript?.relPath || "";
        const activeKind = this.activeScript?.kind || "pygame";
        const html = (0, python_c_preview_html_1.renderPythonCPreviewHtml)(this.scripts, activeRel, activeKind);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
    }
}
exports.PythonCVisualAdapter = PythonCVisualAdapter;
//# sourceMappingURL=python-c-adapter.js.map