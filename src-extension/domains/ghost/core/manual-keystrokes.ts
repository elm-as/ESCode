import * as vscode from 'vscode';

/**
 * Captures user keystrokes in manual mode by overriding VS Code's `type`
 * command, so each key press becomes one "tick" instead of reaching the
 * document. Only one extension can own `type` at a time.
 */
export class ManualKeystrokeSource {
  private pendingTicks = 0;
  private waiter: (() => void) | undefined;
  private registration: vscode.Disposable | undefined;

  start(): void {
    if (this.registration) { return; }
    this.pendingTicks = 0;
    try {
      this.registration = vscode.commands.registerCommand('type', () => this.handleKeystroke());
    } catch (err) {
      throw new Error(
        'Manual mode needs to capture keystrokes, but another extension (e.g. Vim) '
        + `already handles typing. Disable it or use auto mode. (${String(err)})`
      );
    }
  }

  stop(): void {
    this.registration?.dispose();
    this.registration = undefined;
    this.pendingTicks = 0;
    this.wake();
  }

  /** Resolves on the next keystroke (or immediately if one is buffered). */
  next(signal: AbortSignal): Promise<void> {
    if (this.pendingTicks > 0) {
      this.pendingTicks--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = (): void => {
        this.waiter = undefined;
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiter = () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
    });
  }

  /** Releases a pending next() without consuming a keystroke (skip / stop). */
  wake(): void {
    const waiter = this.waiter;
    this.waiter = undefined;
    waiter?.();
  }

  private handleKeystroke(): void {
    this.pendingTicks += 2;
    if (this.waiter) {
      this.pendingTicks--;
      this.wake();
    }
  }
}
