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
exports.ActionPlayer = void 0;
const vscode = __importStar(require("vscode"));
const document_controller_1 = require("../../vscode/document-controller");
const cursor_controller_1 = require("../../vscode/cursor-controller");
const TypingEngine_1 = require("../../core/TypingEngine");
const TerminalEngine_1 = require("../../core/TerminalEngine");
const logger_1 = require("../../infrastructure/logger");
const random_1 = require("../../infrastructure/random");
const project_paths_1 = require("../../infrastructure/project-paths");
const types_1 = require("../../types");
const CURSOR_SETTLE_MS = 80;
const DIAGNOSTIC_GLANCE_MS = 200;
const BACKSPACE_INTERVAL_MS = 30;
const PAUSE_POLL_MS = 100;
const DEFAULT_COMMAND_TIMEOUT_MS = 60000;
/**
 * ActionPlayer executes a planned timeline of CodingActions sequentially
 * across multiple files, coordinating editor, cursor, thinking pauses,
 * the typing engine and the integrated terminal.
 * It does not configure the typing engine: its owner does.
 */
class ActionPlayer {
    typingEngine;
    terminalEngine;
    documentController;
    cursorController;
    logger = logger_1.Logger.getInstance();
    actionListeners = [];
    stateListeners = [];
    state = types_1.EngineState.IDLE;
    abortController;
    paused = false;
    commandTimeout = DEFAULT_COMMAND_TIMEOUT_MS;
    filePreparer;
    currentEditor;
    preparedFiles = new Set();
    skippedFiles = new Set();
    constructor(typingEngine = new TypingEngine_1.TypingEngine(), terminalEngine = new TerminalEngine_1.TerminalEngine(), documentController = new document_controller_1.DocumentController(), cursorController = new cursor_controller_1.CursorController()) {
        this.typingEngine = typingEngine;
        this.terminalEngine = terminalEngine;
        this.documentController = documentController;
        this.cursorController = cursorController;
    }
    setCommandTimeout(timeoutMs) {
        this.commandTimeout = timeoutMs;
    }
    setFilePreparer(preparer) {
        this.filePreparer = preparer;
    }
    addActionListener(listener) {
        this.actionListeners.push(listener);
    }
    addStateListener(listener) {
        this.stateListeners.push(listener);
    }
    getState() {
        return this.state;
    }
    async play(actions, projectRoot = '') {
        if (actions.length === 0) {
            this.logger.warn('ActionPlayer: no actions to execute');
            return;
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        this.paused = false;
        this.preparedFiles.clear();
        this.skippedFiles.clear();
        this.currentEditor = undefined;
        this.transitionTo(types_1.EngineState.TYPING);
        try {
            for (let i = 0; i < actions.length && !signal.aborted; i++) {
                await this.waitWhilePaused(signal);
                this.actionListeners.forEach(listener => listener(actions[i], i, actions.length));
                await this.executeAction(actions[i], { projectRoot, signal });
            }
            await this.saveCurrentFile();
            this.transitionTo(signal.aborted ? types_1.EngineState.CANCELLED : types_1.EngineState.COMPLETED);
        }
        catch (err) {
            if (!(0, random_1.isAbortError)(err)) {
                this.logger.error('ActionPlayer execution error', err);
                this.transitionTo(types_1.EngineState.ERROR);
                throw err;
            }
            this.transitionTo(types_1.EngineState.CANCELLED);
        }
    }
    /** Holds the timeline between actions; typing itself is paused by the owner. */
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }
    stop() {
        this.abortController?.abort();
        this.typingEngine.cancel();
        this.paused = false;
    }
    async executeAction(action, context) {
        const { signal } = context;
        switch (action.type) {
            case 'openFile':
                return this.handleOpenFile(action.path, context.projectRoot);
            case 'moveCursor':
                this.handleMoveCursor(action);
                return (0, random_1.createCancellableDelay)(CURSOR_SETTLE_MS, signal);
            case 'think':
                return this.handleThink(action.durationMs, signal);
            case 'typeText':
                return this.handleTypeText(action.text);
            case 'backspace':
                return this.handleBackspace(action.count, signal);
            case 'revision':
                return this.handleRevision(action.start, action.end, action.replacementText);
            case 'runTerminal':
                return this.handleRunTerminal(action.command, signal);
            case 'inspectDiagnostic':
                return (0, random_1.createCancellableDelay)(DIAGNOSTIC_GLANCE_MS, signal);
        }
    }
    async handleOpenFile(filePath, projectRoot) {
        await this.saveCurrentFile();
        this.currentEditor = undefined;
        if (this.skippedFiles.has(filePath)) {
            return;
        }
        const editor = await this.documentController.createAndOpenFile((0, project_paths_1.resolveProjectPath)(projectRoot || '.', filePath));
        if (!this.preparedFiles.has(filePath)) {
            this.preparedFiles.add(filePath);
            const keep = this.filePreparer ? await this.filePreparer(editor) : true;
            if (!keep) {
                this.skippedFiles.add(filePath);
                return;
            }
        }
        this.currentEditor = editor;
    }
    handleMoveCursor(action) {
        if (!this.currentEditor) {
            return;
        }
        const doc = this.currentEditor.document;
        const pos = doc.validatePosition(new vscode.Position(action.line, action.character));
        if (!action.selectLength) {
            this.cursorController.moveTo(this.currentEditor, pos);
            return;
        }
        const endPos = doc.validatePosition(pos.translate(0, action.selectLength));
        this.currentEditor.selection = new vscode.Selection(pos, endPos);
        this.currentEditor.revealRange(new vscode.Range(pos, endPos));
    }
    async handleThink(durationMs, signal) {
        this.transitionTo(types_1.EngineState.PREPARING);
        await (0, random_1.createCancellableDelay)(durationMs, signal);
        this.transitionTo(types_1.EngineState.TYPING);
    }
    async handleTypeText(text) {
        if (!this.currentEditor) {
            return;
        }
        await this.typingEngine.typeContent(this.currentEditor, text);
    }
    async handleBackspace(count, signal) {
        if (!this.currentEditor) {
            return;
        }
        for (let c = 0; c < count && !signal.aborted; c++) {
            await vscode.commands.executeCommand('deleteLeft');
            await (0, random_1.createCancellableDelay)(BACKSPACE_INTERVAL_MS, signal);
        }
    }
    async handleRevision(start, end, replacement = '') {
        if (!this.currentEditor) {
            return;
        }
        const startPos = new vscode.Position(start.line, start.character);
        const endPos = end ? new vscode.Position(end.line, end.character) : startPos;
        await this.documentController.replaceRange(this.currentEditor, new vscode.Range(startPos, endPos), replacement);
    }
    async handleRunTerminal(command, signal) {
        await this.saveCurrentFile();
        this.transitionTo(types_1.EngineState.EXECUTING);
        await this.terminalEngine.executeCommand({
            command,
            cwd: '.',
            waitForCompletion: true,
            timeout: this.commandTimeout,
            onFailure: types_1.ErrorOnFailure.CONTINUE,
        }, signal);
        this.transitionTo(types_1.EngineState.TYPING);
    }
    async saveCurrentFile() {
        if (!this.currentEditor) {
            return;
        }
        await this.documentController.save(this.currentEditor);
    }
    async waitWhilePaused(signal) {
        if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        while (this.paused) {
            await (0, random_1.createCancellableDelay)(PAUSE_POLL_MS, signal);
        }
    }
    transitionTo(newState) {
        if (this.state === newState) {
            return;
        }
        this.state = newState;
        this.stateListeners.forEach(listener => listener(newState));
    }
}
exports.ActionPlayer = ActionPlayer;
//# sourceMappingURL=ActionPlayer.js.map