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
exports.TerminalEngine = void 0;
const vscode = __importStar(require("vscode"));
const terminal_controller_1 = require("../vscode/terminal-controller");
const logger_1 = require("../infrastructure/logger");
const random_1 = require("../infrastructure/random");
/**
 * Orchestrates terminal command execution with authorization,
 * timeout, and failure-handling policies.
 *
 * Security model: every command must pass through requestAuthorization
 * before execution. The UI layer calls authorizeCommand to whitelist
 * a command for the current session.
 */
class TerminalEngine {
    controller;
    logger = logger_1.Logger.getInstance();
    /** Commands the user has authorized for this session. */
    sessionAllowList = new Set();
    /** Callback the UI must register to show authorization prompts. */
    authorizationHandler;
    constructor() {
        this.controller = new terminal_controller_1.TerminalController();
    }
    /**
     * Register the handler that will be called when a command needs
     * user authorization. Must be set before any command execution.
     */
    setAuthorizationHandler(handler) {
        this.authorizationHandler = handler;
    }
    /**
     * Execute a terminal command with full authorization and timeout flow.
     * Returns true if the command completed successfully.
     */
    async executeCommand(command, signal) {
        // — Authorization gate —
        const authorized = await this.requestAuthorization(command.command, command.cwd);
        if (!authorized) {
            this.logger.warn(`Command denied: ${command.command}`);
            return false;
        }
        this.logger.info(`Executing command: ${command.command}`);
        this.controller.sendCommand(command.command);
        if (!command.waitForCompletion) {
            return true;
        }
        // VS Code doesn't expose a "command finished" event on terminals,
        // so we wait for the configured timeout and trust the user's config.
        try {
            await (0, random_1.createCancellableDelay)(command.timeout, signal);
        }
        catch {
            this.logger.warn('Command wait cancelled');
            return false;
        }
        this.logger.info(`Command completed (timeout-based): ${command.command}`);
        return true;
    }
    /**
     * Check whether the command is authorized to run.
     * Uses session allow-list first, then falls back to the UI prompt.
     */
    async requestAuthorization(command, cwd) {
        if (this.sessionAllowList.has(command)) {
            return true;
        }
        if (!this.authorizationHandler) {
            // No handler registered — use VS Code's built-in quick pick
            return this.fallbackAuthorizationPrompt(command, cwd);
        }
        const decision = await this.authorizationHandler(command, cwd);
        switch (decision) {
            case 'allowOnce':
                return true;
            case 'allowSession':
                this.sessionAllowList.add(command);
                return true;
            case 'deny':
                return false;
        }
    }
    /**
     * Fallback prompt using VS Code's native quick pick,
     * used when no webview authorization handler is registered.
     */
    async fallbackAuthorizationPrompt(command, cwd) {
        const choice = await vscode.window.showWarningMessage(`FakeCoder wants to run:\n\n${command}\n\nWorking directory: ${cwd}`, { modal: true }, 'Allow once', 'Allow for session', 'Deny');
        if (choice === 'Allow once') {
            return true;
        }
        if (choice === 'Allow for session') {
            this.sessionAllowList.add(command);
            return true;
        }
        return false;
    }
    dispose() {
        this.controller.dispose();
        this.sessionAllowList.clear();
    }
}
exports.TerminalEngine = TerminalEngine;
//# sourceMappingURL=TerminalEngine.js.map