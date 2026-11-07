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
exports.FlutterAdapter = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const process_manager_1 = require("../process/process-manager");
const sdk_detector_1 = require("../sdk/sdk-detector");
const flutter_project_scanner_1 = require("./flutter-project-scanner");
const flutter_live_compiler_1 = require("./flutter-live-compiler");
const flutter_preview_html_1 = require("./flutter-preview-html");
class FlutterAdapter {
    name = "Flutter";
    framework = "flutter";
    currentStatus = { state: "idle", mode: "fast" };
    activeProcessId = null;
    activeAppId = null;
    restartRequestId = 1;
    fastServer = null;
    sseClients = [];
    projectPath = "";
    memoryBuffers = new Map();
    preferredScreen = null;
    async detectProject(projectPath) {
        const pubspec = path.join(projectPath, "pubspec.yaml");
        return fs.existsSync(pubspec);
    }
    async validateEnvironment(mode) {
        if (mode === "fast") {
            return { valid: true };
        }
        const toolchain = await sdk_detector_1.sdkDetector.scanToolchain();
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
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
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
    startFastLiveServer(options) {
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
    startNativeAndroidRunner(options) {
        const processId = `flutter_native_${Date.now()}`;
        this.activeProcessId = processId;
        this.activeAppId = null;
        process_manager_1.processManager.startProcess({
            id: processId,
            command: "flutter",
            args: ["run", "--machine", "-d", "android"],
            cwd: options.projectPath,
            onStdout: (line) => this.handleMachineStdout(line),
        });
        const previewUrl = `http://127.0.0.1:${options.port}`;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        return {
            previewUrl,
            port: options.port,
            processId,
        };
    }
    handleMachineStdout(line) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("[{"))
            return;
        try {
            const events = JSON.parse(trimmed);
            for (const evt of events) {
                if (evt.event === "app.start" && evt.params?.appId) {
                    this.activeAppId = evt.params.appId;
                }
            }
        }
        catch {
            // Non-JSON stdout line
        }
    }
    handleFastHttpRequest(req, res) {
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
                const mime = ext === ".png" ? "image/png" :
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
        const snapshot = (0, flutter_project_scanner_1.scanFlutterWorkspace)(this.projectPath, this.memoryBuffers, this.preferredScreen);
        const compiled = (0, flutter_live_compiler_1.compileFlutterWorkspace)(snapshot);
        const html = (0, flutter_preview_html_1.renderFlutterPreviewDocument)(compiled);
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        });
        res.end(html);
    }
    async onDocumentEdited(filePath, content) {
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
    async reload() {
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
                process_manager_1.processManager.writeStdin(this.activeProcessId, `${rpc}\n`);
            }
            else {
                process_manager_1.processManager.writeStdin(this.activeProcessId, "r\n");
            }
        }
    }
    broadcastLivePatch() {
        if (this.sseClients.length === 0)
            return;
        const snapshot = (0, flutter_project_scanner_1.scanFlutterWorkspace)(this.projectPath, this.memoryBuffers, this.preferredScreen);
        const compiled = (0, flutter_live_compiler_1.compileFlutterWorkspace)(snapshot);
        const message = JSON.stringify({ type: "flutter-patch", payload: compiled });
        for (const client of this.sseClients) {
            try {
                client.write(`data: ${message}\n\n`);
            }
            catch {
                // Ignore closed socket
            }
        }
    }
    async stop() {
        if (this.fastServer) {
            for (const client of this.sseClients) {
                try {
                    client.end();
                }
                catch { }
            }
            this.sseClients = [];
            await new Promise((resolve) => {
                this.fastServer?.close(() => resolve());
                this.fastServer = null;
            });
        }
        if (this.activeProcessId) {
            process_manager_1.processManager.stopProcess(this.activeProcessId);
            this.activeProcessId = null;
            this.activeAppId = null;
        }
        this.currentStatus = { state: "stopped", mode: "fast" };
    }
    getStatus() {
        return this.currentStatus;
    }
    getCapabilities() {
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
exports.FlutterAdapter = FlutterAdapter;
//# sourceMappingURL=flutter-adapter.js.map