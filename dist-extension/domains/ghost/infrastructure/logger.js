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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
/**
 * Singleton logger writing to a VS Code Output Channel named "FakeCoder".
 * Centralised here because every domain module needs structured logging
 * without coupling to vscode.window directly.
 */
class Logger {
    static instance;
    channel;
    level = LogLevel.INFO;
    constructor() {
        this.channel = vscode.window.createOutputChannel('FakeCoder');
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLevel(level) {
        const map = {
            debug: LogLevel.DEBUG,
            info: LogLevel.INFO,
            warn: LogLevel.WARN,
            error: LogLevel.ERROR,
        };
        this.level = map[level] ?? LogLevel.INFO;
    }
    debug(message) {
        if (this.level <= LogLevel.DEBUG) {
            this.write('DEBUG', message);
        }
    }
    info(message) {
        if (this.level <= LogLevel.INFO) {
            this.write('INFO', message);
        }
    }
    warn(message) {
        if (this.level <= LogLevel.WARN) {
            this.write('WARN', message);
        }
    }
    error(message, err) {
        if (this.level <= LogLevel.ERROR) {
            const detail = err instanceof Error ? `: ${err.message}` : '';
            this.write('ERROR', `${message}${detail}`);
        }
    }
    show() {
        this.channel.show(true);
    }
    dispose() {
        this.channel.dispose();
        Logger.instance = undefined;
    }
    write(level, message) {
        const timestamp = new Date().toISOString().slice(11, 23);
        this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map