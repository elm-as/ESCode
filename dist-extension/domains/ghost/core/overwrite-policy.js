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
exports.prepareEditorForTyping = prepareEditorForTyping;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const cursor_controller_1 = require("../vscode/cursor-controller");
const PROMPT_CHOICES = {
    'Replace': types_1.OverwriteStrategy.REPLACE,
    'Append': types_1.OverwriteStrategy.APPEND,
    'Insert at cursor': types_1.OverwriteStrategy.INSERT,
    'Skip': types_1.OverwriteStrategy.IGNORE,
};
/**
 * Prepares an opened editor for typing according to the overwrite strategy:
 * clears or trims the document when needed and places the cursor where
 * typing must start (TypingEngine types at the cursor).
 * @returns false when the file must be skipped.
 */
async function prepareEditorForTyping(editor, strategy, documentController) {
    const cursor = new cursor_controller_1.CursorController();
    if (!documentController.hasExistingContent(editor)) {
        cursor.moveToOffset(editor, 0);
        return true;
    }
    const resolved = strategy === types_1.OverwriteStrategy.ASK
        ? await askOverwriteStrategy(editor)
        : strategy;
    switch (resolved) {
        case types_1.OverwriteStrategy.REPLACE:
        case types_1.OverwriteStrategy.CLEAR_THEN_TYPE:
            await documentController.clearDocument(editor);
            cursor.moveToOffset(editor, 0);
            return true;
        case types_1.OverwriteStrategy.APPEND:
            cursor.moveToEnd(editor);
            return true;
        case types_1.OverwriteStrategy.INSERT:
            return true;
        case types_1.OverwriteStrategy.OVERWRITE_FROM_CURSOR:
            await documentController.deleteFromCursorToEnd(editor);
            return true;
        default:
            return false;
    }
}
async function askOverwriteStrategy(editor) {
    const fileName = vscode.workspace.asRelativePath(editor.document.uri);
    const choice = await vscode.window.showWarningMessage(`File "${fileName}" already exists. What should FakeCoder do?`, ...Object.keys(PROMPT_CHOICES));
    return PROMPT_CHOICES[choice ?? 'Skip'] ?? types_1.OverwriteStrategy.IGNORE;
}
//# sourceMappingURL=overwrite-policy.js.map