import * as vscode from 'vscode';

/**
 * Controls the visible cursor position in VS Code editors.
 * Separated from DocumentController because cursor movements
 * during correction sequences need independent control.
 */
export class CursorController {
  /**
   * Move the cursor to a specific position and reveal it.
   */
  moveTo(editor: vscode.TextEditor, position: vscode.Position): void {
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
  }

  /**
   * Move the cursor to a specific character offset in the document.
   */
  moveToOffset(editor: vscode.TextEditor, offset: number): void {
    const position = editor.document.positionAt(offset);
    this.moveTo(editor, position);
  }

  /**
   * Move the cursor to the end of the document.
   */
  moveToEnd(editor: vscode.TextEditor): void {
    const doc = editor.document;
    const lastLine = doc.lineAt(doc.lineCount - 1);
    this.moveTo(editor, lastLine.range.end);
  }

  /**
   * Move the cursor left by N characters.
   */
  moveLeft(editor: vscode.TextEditor, count: number = 1): void {
    const currentOffset = editor.document.offsetAt(editor.selection.active);
    const newOffset = Math.max(0, currentOffset - count);
    this.moveToOffset(editor, newOffset);
  }

  /**
   * Move the cursor right by N characters.
   */
  moveRight(editor: vscode.TextEditor, count: number = 1): void {
    const currentOffset = editor.document.offsetAt(editor.selection.active);
    const maxOffset = editor.document.getText().length;
    const newOffset = Math.min(maxOffset, currentOffset + count);
    this.moveToOffset(editor, newOffset);
  }

  /**
   * Get the current cursor offset in the document.
   */
  getCurrentOffset(editor: vscode.TextEditor): number {
    return editor.document.offsetAt(editor.selection.active);
  }
}
