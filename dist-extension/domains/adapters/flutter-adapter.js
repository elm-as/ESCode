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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const process_manager_1 = require("../process/process-manager");
const sdk_detector_1 = require("../sdk/sdk-detector");
class FlutterAdapter {
    name = "Flutter";
    framework = "flutter";
    currentStatus = { state: "idle", mode: "fast" };
    activeProcessId = null;
    async detectProject(projectPath) {
        const pubspec = path.join(projectPath, "pubspec.yaml");
        return fs.existsSync(pubspec);
    }
    async validateEnvironment(mode) {
        const toolchain = await sdk_detector_1.sdkDetector.scanToolchain();
        const hasFlutter = toolchain.tools.some((t) => t.name === "Flutter" && t.installed);
        if (!hasFlutter) {
            return {
                valid: false,
                reason: "Flutter SDK was not detected in PATH or Flutter SDK directory.",
            };
        }
        if (mode === "native") {
            const hasAdb = toolchain.tools.some((t) => t.name.includes("ADB") && t.installed);
            if (!hasAdb) {
                return {
                    valid: false,
                    reason: "Android ADB is required for Flutter native preview target.",
                };
            }
        }
        return { valid: true };
    }
    async initialize() {
        this.currentStatus = { state: "idle", mode: "fast" };
    }
    async start(options) {
        this.currentStatus = { state: "starting", mode: options.mode, port: options.port };
        const processId = `flutter_${Date.now()}`;
        this.activeProcessId = processId;
        const command = "flutter";
        const args = options.mode === "fast"
            ? ["run", "-d", "web-server", `--web-port=${options.port}`, "--web-hostname=127.0.0.1"]
            : ["run", "-d", "android"];
        try {
            process_manager_1.processManager.startProcess({
                id: processId,
                command,
                args,
                cwd: options.projectPath,
            });
            const previewUrl = `http://127.0.0.1:${options.port}`;
            this.currentStatus = { state: "running", mode: options.mode, port: options.port };
            return {
                previewUrl,
                port: options.port,
                processId,
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.currentStatus = { state: "error", mode: options.mode, error: msg };
            throw new Error(`Failed to start Flutter engine: ${msg}`);
        }
    }
    async stop() {
        if (this.activeProcessId) {
            process_manager_1.processManager.stopProcess(this.activeProcessId);
            this.activeProcessId = null;
        }
        this.currentStatus = { state: "stopped", mode: "fast" };
    }
    async reload() {
        // Flutter reload triggers via stdin or terminal
    }
    getStatus() {
        return this.currentStatus;
    }
    getCapabilities() {
        return {
            supportsFastPreview: true,
            supportsNativePreview: true,
            supportsHmr: false,
            supportsHotRestart: true,
            supportsElementInspection: true,
            targetPlatform: "Flutter Engine (CanvasKit / Skia)",
        };
    }
}
exports.FlutterAdapter = FlutterAdapter;
//# sourceMappingURL=flutter-adapter.js.map