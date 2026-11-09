import * as vscode from 'vscode';

/**
 * Thin wrapper around VS Code's TextEditor and WorkspaceEdit APIs.
 * Keeps cursor/selection logic out of the typing engine so the engine
 * stays testable without a live VS Code instance.
 */
export class DocumentController {
  /**
   * Create a file on disk and any missing parent directories,
   * then open it in the editor.
   * Returns the opened TextEditor.
   */
  async createAndOpenFile(absolutePath: string): Promise<vscode.TextEditor> {
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
  async openFile(absolutePath: string): Promise<vscode.TextEditor> {
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
  async insertTextAt(
    editor: vscode.TextEditor,
    position: vscode.Position,
    text: string
  ): Promise<boolean> {
    return editor.edit(editBuilder => {
      editBuilder.insert(position, text);
    });
  }

  /**
   * Delete a range of text in the document.
   */
  async deleteRange(
    editor: vscode.TextEditor,
    range: vscode.Range
  ): Promise<boolean> {
    return editor.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  /**
   * Replace a range of text with new content.
   */
  async replaceRange(
    editor: vscode.TextEditor,
    range: vscode.Range,
    newText: string
  ): Promise<boolean> {
    return editor.edit(editBuilder => {
      editBuilder.replace(range, newText);
    });
  }

  /**
   * Clear the entire document content.
   */
  async clearDocument(editor: vscode.TextEditor): Promise<boolean> {
    const doc = editor.document;
    if (doc.getText().length === 0) {
      return true;
    }
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );
    return this.deleteRange(editor, fullRange);
  }

  /**
   * Delete everything between the cursor and the end of the document.
   */
  async deleteFromCursorToEnd(editor: vscode.TextEditor): Promise<boolean> {
    const doc = editor.document;
    const end = doc.positionAt(doc.getText().length);
    return this.deleteRange(editor, new vscode.Range(editor.selection.active, end));
  }

  /**
   * Save the document so tools run from the terminal (npm install,
   * compilers…) see what was typed.
   */
  async save(editor: vscode.TextEditor): Promise<boolean> {
    return editor.document.isDirty ? editor.document.save() : true;
  }

  /**
   * Check whether a file already has content.
   */
  hasExistingContent(editor: vscode.TextEditor): boolean {
    return editor.document.getText().length > 0;
  }
}
