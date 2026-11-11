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
exports.PolyglotUniversalAdapter = void 0;
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const polyglot_manifest_1 = require("./polyglot-manifest");
const polyglot_preview_html_1 = require("./polyglot-preview-html");
const process_manager_1 = require("../process/process-manager");
class PolyglotUniversalAdapter {
    name = "Polyglot Universal Runner (Rust/Go/Zig/Custom)";
    framework = "polyglot_custom";
    currentStatus = { state: "idle", mode: "fast" };
    server = null;
    activeTarget = null;
    activeChild = null;
    sseClients = [];
    accumulatedAnsi = "";
    reloadDebounceTimer = null;
    async detectProject(projectPath) {
        const target = (0, polyglot_manifest_1.detectPolyglotTarget)(projectPath);
        return target !== null;
    }
    async validateEnvironment(_mode) {
        return { valid: true };
    }
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
        await this.stop();
        const target = (0, polyglot_manifest_1.detectPolyglotTarget)(options.projectPath);
        if (!target) {
            throw new Error(`Aucune configuration polyglotte trouvée pour ${options.projectPath}`);
        }
        this.activeTarget = target;
        this.launchProcess(options.projectPath, target);
        return new Promise((resolve, reject) => {
            const srv = http.createServer((req, res) => this.handleHttp(req, res));
            srv.on("error", (err) => reject(err));
            srv.listen(options.port, "127.0.0.1", () => {
                this.server = srv;
                this.currentStatus = { state: "running", mode: options.mode, port: options.port };
                resolve({
                    previewUrl: `http://localhost:${options.port}`,
                    port: options.port,
                    processId: `polyglot_${options.port}`,
                });
            });
        });
    }
    async stop() {
        if (this.activeChild) {
            (0, process_manager_1.killProcessTree)(this.activeChild);
            this.activeChild = null;
        }
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
        if (this.activeTarget) {
            const root = path.resolve(".");
            this.launchProcess(root, this.activeTarget);
        }
    }
    async onDocumentEdited(filePath, _content) {
        if (!this.activeTarget)
            return;
        const ext = path.extname(filePath).toLowerCase();
        const matches = this.activeTarget.watchPatterns.some((pat) => pat === "**/*" || ext === pat || pat.endsWith(ext));
        if (!matches)
            return;
        if (this.reloadDebounceTimer)
            clearTimeout(this.reloadDebounceTimer);
        this.reloadDebounceTimer = setTimeout(() => {
            this.reload();
        }, 280);
    }
    getStatus() {
        return this.currentStatus;
    }
    getCapabilities() {
        return {
            supportsFastPreview: true,
            supportsNativePreview: false,
            supportsHmr: false,
            supportsHotRestart: true,
            supportsElementInspection: false,
            targetPlatform: "polyglot-desktop",
        };
    }
    launchProcess(projectPath, target) {
        if (this.activeChild) {
            try {
                this.activeChild.kill();
            }
            catch { }
            this.activeChild = null;
        }
        this.accumulatedAnsi = `[${target.name}] Démarrage de: ${target.command}\n`;
        const child = process_manager_1.processManager.startProcess({
            id: "polyglot_exec",
            command: target.command,
            args: [],
            cwd: projectPath,
            onStdout: (line) => {
                this.accumulatedAnsi = (this.accumulatedAnsi + line + "\n").slice(-8000);
                this.broadcastEvent({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) });
            },
            onStderr: (line) => {
                this.accumulatedAnsi = (this.accumulatedAnsi + line + "\n").slice(-8000);
                this.broadcastEvent({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) });
            },
            onExit: (code) => {
                const status = code === 0 ? "Terminé (0)" : `Sortie code ${code}`;
                this.broadcastEvent({ type: "status", text: status });
            },
        });
        this.activeChild = child;
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
        if (parsed.pathname === "/__elmas_polyglot_events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            res.write(`data: ${JSON.stringify({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) })}\n\n`);
            this.sseClients.push(res);
            req.on("close", () => {
                this.sseClients = this.sseClients.filter((c) => c !== res);
            });
            return;
        }
        if (parsed.pathname === "/__elmas_polyglot_key" && req.method === "POST") {
            const k = parsed.searchParams.get("key") || "SPACE";
            try {
                this.activeChild?.stdin?.write(`${k === "SPACE" ? " " : k}\n`);
            }
            catch { }
            res.writeHead(200);
            res.end("ok");
            return;
        }
        if (parsed.pathname === "/__elmas_polyglot_restart" && req.method === "POST") {
            void this.reload();
            res.writeHead(200);
            res.end("ok");
            return;
        }
        if (!this.activeTarget) {
            res.writeHead(404);
            res.end("No active polyglot target");
            return;
        }
        const previewUrl = this.activeTarget.port ? `http://localhost:${this.activeTarget.port}` : "";
        const html = (0, polyglot_preview_html_1.renderPolyglotPreviewHtml)(this.activeTarget, previewUrl);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
    }
}
exports.PolyglotUniversalAdapter = PolyglotUniversalAdapter;
function escapeHtml(raw) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//# sourceMappingURL=polyglot-adapter.js.map