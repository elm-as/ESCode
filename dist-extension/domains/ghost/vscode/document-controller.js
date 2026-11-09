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
exports.DocumentController = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Thin wrapper around VS Code's TextEditor and WorkspaceEdit APIs.
 * Keeps cursor/selection logic out of the typing engine so the engine
 * stays testable without a live VS Code instance.
 */
class DocumentController {
    /**
     * Create a file on disk and any missing parent directories,
     * then open it in the editor.
     * Returns the opened TextEditor.
     */
    async createAndOpenFile(absolutePath) {
        const uri = vscode.Uri.file(absolutePath);
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { ignoreIfExists: true });
        await vscode.workspace.applyEdit(edit);
        const document = await vscode.workspace.openTextDocument(uri);
        return vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One,
            preview: false,
            preserveFocus: false,
        });
    }
    /**
     * Open an existing file in the editor.
     */
    async openFile(absolutePath) {
        const uri = vscode.Uri.file(absolutePath);
        const document = await vscode.workspace.openTextDocument(uri);
        return vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One,
            preview: false,
            preserveFocus: false,
        });
    }
    /**
     * Insert text at a specific position in the document.
     * Returns true if the edit succeeded.
     */
    async insertTextAt(editor, position, text) {
        return editor.edit(editBuilder => {
            editBuilder.insert(position, text);
        });
    }
    /**
     * Delete a range of text in the document.
     */
    async deleteRange(editor, range) {
        return editor.edit(editBuilder => {
            editBuilder.delete(range);
        });
    }
    /**
     * Replace a range of text with new content.
     */
    async replaceRange(editor, range, newText) {
        return editor.edit(editBuilder => {
            editBuilder.replace(range, newText);
        });
    }
    /**
     * Clear the entire document content.
     */
    async clearDocument(editor) {
        const doc = editor.document;
        if (doc.getText().length === 0) {
            return true;
        }
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        return this.deleteRange(editor, fullRange);
    }
    /**
     * Delete everything between the cursor and the end of the document.
     */
    async deleteFromCursorToEnd(editor) {
        const doc = editor.document;
        const end = doc.positionAt(doc.getText().length);
        return this.deleteRange(editor, new vscode.Range(editor.selection.active, end));
    }
    /**
     * Save the document so tools run from the terminal (npm install,
     * compilers…) see what was typed.
     */
    async save(editor) {
        return editor.document.isDirty ? editor.document.save() : true;
    }
    /**
     * Check whether a file already has content.
     */
    hasExistingContent(editor) {
        return editor.document.getText().length > 0;
    }
}
exports.DocumentController = DocumentController;
//# sourceMappingURL=document-controller.js.map