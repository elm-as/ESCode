import * as vscode from 'vscode';
import { OverwriteStrategy } from '../types';
import { DocumentController } from '../vscode/document-controller';
import { CursorController } from '../vscode/cursor-controller';

const PROMPT_CHOICES: Record<string, OverwriteStrategy> = {
  'Replace': OverwriteStrategy.REPLACE,
  'Append': OverwriteStrategy.APPEND,
  'Insert at cursor': OverwriteStrategy.INSERT,
  'Skip': OverwriteStrategy.IGNORE,
};

/**
 * Prepares an opened editor for typing according to the overwrite strategy:
 * clears or trims the document when needed and places the cursor where
 * typing must start (TypingEngine types at the cursor).
 * @returns false when the file must be skipped.
 */
export async function prepareEditorForTyping(
  editor: vscode.TextEditor,
  strategy: OverwriteStrategy,
  documentController: DocumentController
): Promise<boolean> {
  const cursor = new CursorController();
  if (!documentController.hasExistingContent(editor)) {
    cursor.moveToOffset(editor, 0);
    return true;
  }

  const resolved = strategy === OverwriteStrategy.ASK
    ? await askOverwriteStrategy(editor)
    : strategy;

  switch (resolved) {
    case OverwriteStrategy.REPLACE:
    case OverwriteStrategy.CLEAR_THEN_TYPE:
      await documentController.clearDocument(editor);
      cursor.moveToOffset(editor, 0);
      return true;
    case OverwriteStrategy.APPEND:
      cursor.moveToEnd(editor);
      return true;
    case OverwriteStrategy.INSERT:
      return true;
    case OverwriteStrategy.OVERWRITE_FROM_CURSOR:
      await documentController.deleteFromCursorToEnd(editor);
      return true;
    default:
      return false;
  }
}

async function askOverwriteStrategy(editor: vscode.TextEditor): Promise<OverwriteStrategy> {
  const fileName = vscode.workspace.asRelativePath(editor.document.uri);
  const choice = await vscode.window.showWarningMessage(
    `File "${fileName}" already exists. What should FakeCoder do?`,
    ...Object.keys(PROMPT_CHOICES)
  );
  return PROMPT_CHOICES[choice ?? 'Skip'] ?? OverwriteStrategy.IGNORE;
}
