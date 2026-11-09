import * as vscode from 'vscode';
import { Logger } from '../infrastructure/logger';

/**
 * Manages VS Code integrated terminal instances for command execution.
 * Handles creation, text sending, and lifecycle — but never decides
 * *what* to run (that's TerminalEngine's responsibility).
 */
export class TerminalController {
  private terminal: vscode.Terminal | undefined;
  private readonly logger = Logger.getInstance();

  /**
   * Get or create a FakeCoder terminal instance.
   */
  getOrCreateTerminal(): vscode.Terminal {
    // Reuse existing terminal if it hasn't been disposed
    if (this.terminal && !this.isTerminalDisposed()) {
      this.terminal.show();
      return this.terminal;
    }

    this.terminal = vscode.window.createTerminal({
      name: 'FakeCoder',
      hideFromUser: false,
    });
    this.terminal.show();
    this.logger.info('Terminal created');
    return this.terminal;
  }

  /**
   * Send a command string to the terminal.
   * @param addNewline If true, appends a newline to execute the command.
   */
  sendCommand(command: string, addNewline: boolean = true): void {
    const terminal = this.getOrCreateTerminal();
    terminal.sendText(command, addNewline);
    this.logger.info(`Terminal command sent: ${command}`);
  }

  /**
   * Dispose the terminal if it exists.
   */
  dispose(): void {
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = undefined;
    }
  }

  /**
   * VS Code doesn't expose a direct "isDisposed" API for terminals,
   * so we check against the list of active terminals.
   */
  private isTerminalDisposed(): boolean {
    if (!this.terminal) {
      return true;
    }
    return !vscode.window.terminals.includes(this.terminal);
  }
}
