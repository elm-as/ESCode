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
exports.TerminalController = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../infrastructure/logger");
/**
 * Manages VS Code integrated terminal instances for command execution.
 * Handles creation, text sending, and lifecycle — but never decides
 * *what* to run (that's TerminalEngine's responsibility).
 */
class TerminalController {
    terminal;
    logger = logger_1.Logger.getInstance();
    /**
     * Get or create a FakeCoder terminal instance.
     */
    getOrCreateTerminal() {
        // Reuse existing terminal if it hasn't been disposed
        if (this.terminal && !this.isTerminalDisposed()) {
            this.terminal.show();
            return this.terminal;
        }
        this.terminal = vscode.window.createTerminal({
            name: 'FakeCoder',
            hideFromUser: false,
        });
        this.terminal.show();
        this.logger.info('Terminal created');
        return this.terminal;
    }
    /**
     * Send a command string to the terminal.
     * @param addNewline If true, appends a newline to execute the command.
     */
    sendCommand(command, addNewline = true) {
        const terminal = this.getOrCreateTerminal();
        terminal.sendText(command, addNewline);
        this.logger.info(`Terminal command sent: ${command}`);
    }
    /**
     * Dispose the terminal if it exists.
     */
    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }
    }
    /**
     * VS Code doesn't expose a direct "isDisposed" API for terminals,
     * so we check against the list of active terminals.
     */
    isTerminalDisposed() {
        if (!this.terminal) {
            return true;
        }
        return !vscode.window.terminals.includes(this.terminal);
    }
}
exports.TerminalController = TerminalController;
//# sourceMappingURL=terminal-controller.js.map