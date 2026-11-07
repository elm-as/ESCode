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
exports.processManager = exports.ExtensionProcessManager = void 0;
const net = __importStar(require("net"));
const child_process_1 = require("child_process");
class ExtensionProcessManager {
    activeProcesses = new Map();
    /**
     * Finds an available dynamic TCP port on 127.0.0.1 without collisions.
     */
    async allocateFreePort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on("error", reject);
            server.listen(0, "127.0.0.1", () => {
                const address = server.address();
                if (address && typeof address === "object") {
                    const port = address.port;
                    server.close(() => resolve(port));
                }
                else {
                    server.close(() => reject(new Error("Unable to read port address")));
                }
            });
        });
    }
    /**
     * Checks if a TCP port is currently accepting connections.
     */
    isPortListening(port, host = "127.0.0.1") {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const onDone = (ok) => {
                socket.removeAllListeners();
                socket.destroy();
                resolve(ok);
            };
            socket.setTimeout(350);
            socket.once("connect", () => onDone(true));
            socket.once("timeout", () => onDone(false));
            socket.once("error", () => onDone(false));
            socket.connect(port, host);
        });
    }
    /**
     * Polls a TCP port until the dev server is actively listening.
     */
    async waitForPortReady(port, host = "127.0.0.1", timeoutMs = 15000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (await this.isPortListening(port, host)) {
                return true;
            }
            await new Promise((r) => setTimeout(r, 120));
        }
        return false;
    }
    startProcess(options) {
        this.stopProcess(options.id);
        const child = (0, child_process_1.spawn)(options.command, options.args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            shell: true,
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
        });
        child.stdout?.on("data", (chunk) => {
            const text = chunk.toString();
            for (const line of text.split(/\r?\n/)) {
                if (line.trim() && options.onStdout)
                    options.onStdout(line);
            }
        });
        child.stderr?.on("data", (chunk) => {
            const text = chunk.toString();
            for (const line of text.split(/\r?\n/)) {
                if (line.trim() && options.onStderr)
                    options.onStderr(line);
            }
        });
        child.on("exit", (code) => {
            this.activeProcesses.delete(options.id);
            if (options.onExit)
                options.onExit(code);
        });
        this.activeProcesses.set(options.id, child);
        return child;
    }
    /**
     * Writes a command or JSON-RPC message directly to a running process's stdin.
     */
    writeStdin(id, input) {
        const child = this.activeProcesses.get(id);
        if (!child || !child.stdin || !child.stdin.writable) {
            return false;
        }
        child.stdin.write(input);
        return true;
    }
    stopProcess(id) {
        const child = this.activeProcesses.get(id);
        if (!child || !child.pid)
            return;
        if (process.platform === "win32") {
            (0, child_process_1.exec)(`taskkill /F /T /PID ${child.pid}`, () => { });
        }
        else {
            try {
                process.kill(-child.pid, "SIGTERM");
            }
            catch {
                child.kill("SIGTERM");
            }
        }
        this.activeProcesses.delete(id);
    }
    stopAll() {
        for (const id of Array.from(this.activeProcesses.keys())) {
            this.stopProcess(id);
        }
    }
}
exports.ExtensionProcessManager = ExtensionProcessManager;
exports.processManager = new ExtensionProcessManager();
//# sourceMappingURL=process-manager.js.map