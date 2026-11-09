import * as vscode from 'vscode';
import { TerminalCommand, ErrorOnFailure } from '../types';
import { TerminalController } from '../vscode/terminal-controller';
import { Logger } from '../infrastructure/logger';
import { createCancellableDelay } from '../infrastructure/random';

/**
 * Orchestrates terminal command execution with authorization,
 * timeout, and failure-handling policies.
 *
 * Security model: every command must pass through requestAuthorization
 * before execution. The UI layer calls authorizeCommand to whitelist
 * a command for the current session.
 */
export class TerminalEngine {
  private readonly controller: TerminalController;
  private readonly logger = Logger.getInstance();

  /** Commands the user has authorized for this session. */
  private readonly sessionAllowList = new Set<string>();

  /** Callback the UI must register to show authorization prompts. */
  private authorizationHandler:
    | ((command: string, cwd: string) => Promise<'allowOnce' | 'allowSession' | 'deny'>)
    | undefined;

  constructor() {
    this.controller = new TerminalController();
  }

  /**
   * Register the handler that will be called when a command needs
   * user authorization. Must be set before any command execution.
   */
  setAuthorizationHandler(
    handler: (command: string, cwd: string) => Promise<'allowOnce' | 'allowSession' | 'deny'>
  ): void {
    this.authorizationHandler = handler;
  }

  /**
   * Execute a terminal command with full authorization and timeout flow.
   * Returns true if the command completed successfully.
   */
  async executeCommand(
    command: TerminalCommand,
    signal?: AbortSignal
  ): Promise<boolean> {
    // — Authorization gate —
    const authorized = await this.requestAuthorization(
      command.command,
      command.cwd
    );
    if (!authorized) {
      this.logger.warn(`Command denied: ${command.command}`);
      return false;
    }

    this.logger.info(`Executing command: ${command.command}`);
    this.controller.sendCommand(command.command);

    if (!command.waitForCompletion) {
      return true;
    }

    // VS Code doesn't expose a "command finished" event on terminals,
    // so we wait for the configured timeout and trust the user's config.
    try {
      await createCancellableDelay(command.timeout, signal);
    } catch {
      this.logger.warn('Command wait cancelled');
      return false;
    }

    this.logger.info(`Command completed (timeout-based): ${command.command}`);
    return true;
  }

  /**
   * Check whether the command is authorized to run.
   * Uses session allow-list first, then falls back to the UI prompt.
   */
  private async requestAuthorization(
    command: string,
    cwd: string
  ): Promise<boolean> {
    if (this.sessionAllowList.has(command)) {
      return true;
    }

    if (!this.authorizationHandler) {
      // No handler registered — use VS Code's built-in quick pick
      return this.fallbackAuthorizationPrompt(command, cwd);
    }

    const decision = await this.authorizationHandler(command, cwd);

    switch (decision) {
      case 'allowOnce':
        return true;
      case 'allowSession':
        this.sessionAllowList.add(command);
        return true;
      case 'deny':
        return false;
    }
  }

  /**
   * Fallback prompt using VS Code's native quick pick,
   * used when no webview authorization handler is registered.
   */
  private async fallbackAuthorizationPrompt(
    command: string,
    cwd: string
  ): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(
      `FakeCoder wants to run:\n\n${command}\n\nWorking directory: ${cwd}`,
      { modal: true },
      'Allow once',
      'Allow for session',
      'Deny'
    );

    if (choice === 'Allow once') {
      return true;
    }
    if (choice === 'Allow for session') {
      this.sessionAllowList.add(command);
      return true;
    }
    return false;
  }

  dispose(): void {
    this.controller.dispose();
    this.sessionAllowList.clear();
  }
}
