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
exports.KotlinComposeAdapter = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const process_manager_1 = require("../process/process-manager");
const sdk_detector_1 = require("../sdk/sdk-detector");
const kotlin_live_compiler_1 = require("./kotlin-live-compiler");
class KotlinComposeAdapter {
    name = "Kotlin / Jetpack Compose";
    framework = "kotlin_compose";
    currentStatus = { state: "idle", mode: "fast" };
    activeProcessId = null;
    fastServer = null;
    sseClients = [];
    projectPath = "";
    memoryKtBuffer = null;
    async detectProject(projectPath) {
        const gradleKts = path.join(projectPath, "build.gradle.kts");
        const gradle = path.join(projectPath, "build.gradle");
        if (fs.existsSync(gradleKts) || fs.existsSync(gradle)) {
            const fileToRead = fs.existsSync(gradleKts) ? gradleKts : gradle;
            try {
                const content = fs.readFileSync(fileToRead, "utf-8").toLowerCase();
                return content.includes("compose") || content.includes("kotlin");
            }
            catch {
                return false;
            }
        }
        return false;
    }
    async validateEnvironment(mode) {
        if (mode === "fast") {
            return { valid: true };
        }
        const toolchain = await sdk_detector_1.sdkDetector.scanToolchain();
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
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
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
        process_manager_1.processManager.startProcess({
            id: processId,
            command: "gradle",
            args: ["assembleDebug"],
            cwd: options.projectPath,
        });
        const previewUrl = `http://127.0.0.1:${options.port}`;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        return { previewUrl, port: options.port, processId };
    }
    readCurrentKotlinSource() {
        if (this.memoryKtBuffer !== null) {
            return this.memoryKtBuffer;
        }
        const mainKt = path.join(this.projectPath, "src", "main", "kotlin", "Main.kt");
        if (fs.existsSync(mainKt)) {
            try {
                return fs.readFileSync(mainKt, "utf-8");
            }
            catch {
                return "";
            }
        }
        return "";
    }
    handleFastHttpRequest(req, res) {
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
        const parsed = (0, kotlin_live_compiler_1.parseKotlinComposeSource)(this.readCurrentKotlinSource());
        const html = (0, kotlin_live_compiler_1.renderKotlinComposeDocument)(parsed);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
    }
    async onDocumentEdited(filePath, content) {
        if (!filePath.toLowerCase().endsWith(".kt"))
            return;
        this.memoryKtBuffer = content;
        this.broadcastPatch(content);
    }
    async reload() {
        this.broadcastPatch(this.readCurrentKotlinSource());
    }
    broadcastPatch(ktSource) {
        if (this.sseClients.length === 0)
            return;
        const parsed = (0, kotlin_live_compiler_1.parseKotlinComposeSource)(ktSource);
        const msg = JSON.stringify({ type: "compose-patch", payload: parsed });
        for (const client of this.sseClients) {
            try {
                client.write(`data: ${msg}\n\n`);
            }
            catch { }
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
            supportsElementInspection: false,
            targetPlatform: "Compose Multiplatform / Android ART",
        };
    }
}
exports.KotlinComposeAdapter = KotlinComposeAdapter;
//# sourceMappingURL=kotlin-adapter.js.map