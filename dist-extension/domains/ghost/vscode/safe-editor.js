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
exports.SafeEditor = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../infrastructure/logger");
const random_1 = require("../infrastructure/random");
/**
 * Minimum gap between two editor.edit() calls.
 * VS Code silently drops edits when they arrive too fast.
 */
const MIN_EDIT_GAP_MS = 12;
const EDIT_RETRY_COUNT = 3;
const RETRY_BACKOFF_MS = 20;
/**
 * Wraps editor.edit() with a rate limiter and retries so that rapid-fire
 * character insertions are never silently dropped by the extension host.
 * Every method reports the real change in document length, because VS Code
 * may normalise inserted text (e.g. line endings) — callers must never
 * assume the delta equals text.length.
 */
class SafeEditor {
    editor;
    lastEditTime = 0;
    logger = logger_1.Logger.getInstance();
    constructor(editor) {
        this.editor = editor;
    }
    get document() {
        return this.editor.document;
    }
    get textEditor() {
        return this.editor;
    }
    async insertAt(offset, text) {
        return this.applyEdit(eb => eb.insert(this.document.positionAt(offset), text), `insert at offset ${offset}`);
    }
    /** Replaces [start, start + deleteCount) with text. */
    async replaceAt(start, deleteCount, text) {
        const docLength = this.document.getText().length;
        const end = Math.min(start + deleteCount, docLength);
        return this.applyEdit(eb => eb.replace(new vscode.Range(this.document.positionAt(start), this.document.positionAt(end)), text), `replace at offset ${start}`);
    }
    async applyEdit(build, description) {
        await this.enforceEditGap();
        for (let attempt = 0; attempt < EDIT_RETRY_COUNT; attempt++) {
            const lengthBefore = this.document.getText().length;
            const ok = await this.editor.edit(build, { undoStopBefore: false, undoStopAfter: false });
            this.lastEditTime = Date.now();
            if (ok) {
                return { applied: true, lengthDelta: this.document.getText().length - lengthBefore };
            }
            await (0, random_1.createCancellableDelay)(RETRY_BACKOFF_MS);
        }
        this.logger.warn(`Edit failed after ${EDIT_RETRY_COUNT} retries: ${description}`);
        return { applied: false, lengthDelta: 0 };
    }
    async enforceEditGap() {
        const elapsed = Date.now() - this.lastEditTime;
        if (elapsed < MIN_EDIT_GAP_MS) {
            await (0, random_1.createCancellableDelay)(MIN_EDIT_GAP_MS - elapsed);
        }
    }
}
exports.SafeEditor = SafeEditor;
//# sourceMappingURL=safe-editor.js.map