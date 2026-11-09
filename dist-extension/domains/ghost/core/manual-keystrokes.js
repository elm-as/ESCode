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
exports.ManualKeystrokeSource = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Captures user keystrokes in manual mode by overriding VS Code's `type`
 * command, so each key press becomes one "tick" instead of reaching the
 * document. Only one extension can own `type` at a time.
 */
class ManualKeystrokeSource {
    pendingTicks = 0;
    waiter;
    registration;
    start() {
        if (this.registration) {
            return;
        }
        this.pendingTicks = 0;
        try {
            this.registration = vscode.commands.registerCommand('type', () => this.handleKeystroke());
        }
        catch (err) {
            throw new Error('Manual mode needs to capture keystrokes, but another extension (e.g. Vim) '
                + `already handles typing. Disable it or use auto mode. (${String(err)})`);
        }
    }
    stop() {
        this.registration?.dispose();
        this.registration = undefined;
        this.pendingTicks = 0;
        this.wake();
    }
    /** Resolves on the next keystroke (or immediately if one is buffered). */
    next(signal) {
        if (this.pendingTicks > 0) {
            this.pendingTicks--;
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            const onAbort = () => {
                this.waiter = undefined;
                reject(new DOMException('Aborted', 'AbortError'));
            };
            signal.addEventListener('abort', onAbort, { once: true });
            this.waiter = () => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            };
        });
    }
    /** Releases a pending next() without consuming a keystroke (skip / stop). */
    wake() {
        const waiter = this.waiter;
        this.waiter = undefined;
        waiter?.();
    }
    handleKeystroke() {
        this.pendingTicks += 2;
        if (this.waiter) {
            this.pendingTicks--;
            this.wake();
        }
    }
}
exports.ManualKeystrokeSource = ManualKeystrokeSource;
//# sourceMappingURL=manual-keystrokes.js.map