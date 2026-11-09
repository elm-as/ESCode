import * as vscode from 'vscode';
import { Logger } from '../infrastructure/logger';
import { createCancellableDelay } from '../infrastructure/random';

/**
 * Minimum gap between two editor.edit() calls.
 * VS Code silently drops edits when they arrive too fast.
 */
const MIN_EDIT_GAP_MS = 12;
const EDIT_RETRY_COUNT = 3;
const RETRY_BACKOFF_MS = 20;

export interface EditResult {
  applied: boolean;
  lengthDelta: number;
}

/**
 * Wraps editor.edit() with a rate limiter and retries so that rapid-fire
 * character insertions are never silently dropped by the extension host.
 * Every method reports the real change in document length, because VS Code
 * may normalise inserted text (e.g. line endings) — callers must never
 * assume the delta equals text.length.
 */
export class SafeEditor {
  private lastEditTime = 0;
  private readonly logger = Logger.getInstance();

  constructor(private readonly editor: vscode.TextEditor) {}

  get document(): vscode.TextDocument {
    return this.editor.document;
  }

  get textEditor(): vscode.TextEditor {
    return this.editor;
  }

  async insertAt(offset: number, text: string): Promise<EditResult> {
    return this.applyEdit(
      eb => eb.insert(this.document.positionAt(offset), text),
      `insert at offset ${offset}`
    );
  }

  /** Replaces [start, start + deleteCount) with text. */
  async replaceAt(start: number, deleteCount: number, text: string): Promise<EditResult> {
    const docLength = this.document.getText().length;
    const end = Math.min(start + deleteCount, docLength);
    return this.applyEdit(
      eb => eb.replace(
        new vscode.Range(this.document.positionAt(start), this.document.positionAt(end)),
        text
      ),
      `replace at offset ${start}`
    );
  }

  private async applyEdit(
    build: (eb: vscode.TextEditorEdit) => void,
    description: string
  ): Promise<EditResult> {
    await this.enforceEditGap();

    for (let attempt = 0; attempt < EDIT_RETRY_COUNT; attempt++) {
      const lengthBefore = this.document.getText().length;
      const ok = await this.editor.edit(build, { undoStopBefore: false, undoStopAfter: false });
      this.lastEditTime = Date.now();
      if (ok) { return { applied: true, lengthDelta: this.document.getText().length - lengthBefore }; }
      await createCancellableDelay(RETRY_BACKOFF_MS);
    }

    this.logger.warn(`Edit failed after ${EDIT_RETRY_COUNT} retries: ${description}`);
    return { applied: false, lengthDelta: 0 };
  }

  private async enforceEditGap(): Promise<void> {
    const elapsed = Date.now() - this.lastEditTime;
    if (elapsed < MIN_EDIT_GAP_MS) {
      await createCancellableDelay(MIN_EDIT_GAP_MS - elapsed);
    }
  }
}
