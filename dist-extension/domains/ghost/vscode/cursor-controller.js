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
exports.CursorController = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Controls the visible cursor position in VS Code editors.
 * Separated from DocumentController because cursor movements
 * during correction sequences need independent control.
 */
class CursorController {
    /**
     * Move the cursor to a specific position and reveal it.
     */
    moveTo(editor, position) {
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    /**
     * Move the cursor to a specific character offset in the document.
     */
    moveToOffset(editor, offset) {
        const position = editor.document.positionAt(offset);
        this.moveTo(editor, position);
    }
    /**
     * Move the cursor to the end of the document.
     */
    moveToEnd(editor) {
        const doc = editor.document;
        const lastLine = doc.lineAt(doc.lineCount - 1);
        this.moveTo(editor, lastLine.range.end);
    }
    /**
     * Move the cursor left by N characters.
     */
    moveLeft(editor, count = 1) {
        const currentOffset = editor.document.offsetAt(editor.selection.active);
        const newOffset = Math.max(0, currentOffset - count);
        this.moveToOffset(editor, newOffset);
    }
    /**
     * Move the cursor right by N characters.
     */
    moveRight(editor, count = 1) {
        const currentOffset = editor.document.offsetAt(editor.selection.active);
        const maxOffset = editor.document.getText().length;
        const newOffset = Math.min(maxOffset, currentOffset + count);
        this.moveToOffset(editor, newOffset);
    }
    /**
     * Get the current cursor offset in the document.
     */
    getCurrentOffset(editor) {
        return editor.document.offsetAt(editor.selection.active);
    }
}
exports.CursorController = CursorController;
//# sourceMappingURL=cursor-controller.js.map