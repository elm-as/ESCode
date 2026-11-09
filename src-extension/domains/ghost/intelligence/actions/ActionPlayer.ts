import * as vscode from 'vscode';
import { CodingAction } from './action-types';
import { CodePosition } from '../knowledge/fact-types';
import { DocumentController } from '../../vscode/document-controller';
import { CursorController } from '../../vscode/cursor-controller';
import { TypingEngine } from '../../core/TypingEngine';
import { TerminalEngine } from '../../core/TerminalEngine';
import { Logger } from '../../infrastructure/logger';
import { createCancellableDelay, isAbortError } from '../../infrastructure/random';
import { resolveProjectPath } from '../../infrastructure/project-paths';
import { EngineState, ErrorOnFailure } from '../../types';

export type ActionCallback = (action: CodingAction, index: number, total: number) => void;

/**
 * Called the first time a file is opened during a session, so existing content
 * can be handled (overwrite strategy). Returning false skips the file.
 */
export type FilePreparer = (editor: vscode.TextEditor) => Promise<boolean>;

const CURSOR_SETTLE_MS = 80;
const DIAGNOSTIC_GLANCE_MS = 200;
const BACKSPACE_INTERVAL_MS = 30;
const PAUSE_POLL_MS = 100;
const DEFAULT_COMMAND_TIMEOUT_MS = 60000;

/**
 * ActionPlayer executes a planned timeline of CodingActions sequentially
 * across multiple files, coordinating editor, cursor, thinking pauses,
 * the typing engine and the integrated terminal.
 * It does not configure the typing engine: its owner does.
 */
export class ActionPlayer {
  private readonly logger = Logger.getInstance();
  private readonly actionListeners: ActionCallback[] = [];
  private readonly stateListeners: Array<(state: EngineState) => void> = [];

  private state: EngineState = EngineState.IDLE;
  private abortController: AbortController | undefined;
  private paused = false;
  private commandTimeout = DEFAULT_COMMAND_TIMEOUT_MS;
  private filePreparer: FilePreparer | undefined;

  private currentEditor: vscode.TextEditor | undefined;
  private readonly preparedFiles = new Set<string>();
  private readonly skippedFiles = new Set<string>();

  constructor(
    private readonly typingEngine: TypingEngine = new TypingEngine(),
    private readonly terminalEngine: TerminalEngine = new TerminalEngine(),
    private readonly documentController: DocumentController = new DocumentController(),
    private readonly cursorController: CursorController = new CursorController()
  ) {}

  setCommandTimeout(timeoutMs: number): void {
    this.commandTimeout = timeoutMs;
  }

  setFilePreparer(preparer: FilePreparer): void {
    this.filePreparer = preparer;
  }

  addActionListener(listener: ActionCallback): void {
    this.actionListeners.push(listener);
  }

  addStateListener(listener: (state: EngineState) => void): void {
    this.stateListeners.push(listener);
  }

  getState(): EngineState {
    return this.state;
  }

  async play(actions: CodingAction[], projectRoot: string = ''): Promise<void> {
    if (actions.length === 0) {
      this.logger.warn('ActionPlayer: no actions to execute');
      return;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    this.paused = false;
    this.preparedFiles.clear();
    this.skippedFiles.clear();
    this.currentEditor = undefined;
    this.transitionTo(EngineState.TYPING);

    try {
      for (let i = 0; i < actions.length && !signal.aborted; i++) {
        await this.waitWhilePaused(signal);
        this.actionListeners.forEach(listener => listener(actions[i], i, actions.length));
        await this.executeAction(actions[i], { projectRoot, signal });
      }
      await this.saveCurrentFile();
      this.transitionTo(signal.aborted ? EngineState.CANCELLED : EngineState.COMPLETED);
    } catch (err) {
      if (!isAbortError(err)) {
        this.logger.error('ActionPlayer execution error', err);
        this.transitionTo(EngineState.ERROR);
        throw err;
      }
      this.transitionTo(EngineState.CANCELLED);
    }
  }

  /** Holds the timeline between actions; typing itself is paused by the owner. */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.abortController?.abort();
    this.typingEngine.cancel();
    this.paused = false;
  }

  private async executeAction(
    action: CodingAction,
    context: { projectRoot: string; signal: AbortSignal }
  ): Promise<void> {
    const { signal } = context;
    switch (action.type) {
      case 'openFile':
        return this.handleOpenFile(action.path, context.projectRoot);
      case 'moveCursor':
        this.handleMoveCursor(action);
        return createCancellableDelay(CURSOR_SETTLE_MS, signal);
      case 'think':
        return this.handleThink(action.durationMs, signal);
      case 'typeText':
        return this.handleTypeText(action.text);
      case 'backspace':
        return this.handleBackspace(action.count, signal);
      case 'revision':
        return this.handleRevision(action.start, action.end, action.replacementText);
      case 'runTerminal':
        return this.handleRunTerminal(action.command, signal);
      case 'inspectDiagnostic':
        return createCancellableDelay(DIAGNOSTIC_GLANCE_MS, signal);
    }
  }

  private async handleOpenFile(filePath: string, projectRoot: string): Promise<void> {
    await this.saveCurrentFile();
    this.currentEditor = undefined;
    if (this.skippedFiles.has(filePath)) { return; }

    const editor = await this.documentController.createAndOpenFile(
      resolveProjectPath(projectRoot || '.', filePath)
    );
    if (!this.preparedFiles.has(filePath)) {
      this.preparedFiles.add(filePath);
      const keep = this.filePreparer ? await this.filePreparer(editor) : true;
      if (!keep) {
        this.skippedFiles.add(filePath);
        return;
      }
    }
    this.currentEditor = editor;
  }

  private handleMoveCursor(action: { line: number; character: number; selectLength?: number }): void {
    if (!this.currentEditor) { return; }
    const doc = this.currentEditor.document;
    const pos = doc.validatePosition(new vscode.Position(action.line, action.character));
    if (!action.selectLength) {
      this.cursorController.moveTo(this.currentEditor, pos);
      return;
    }
    const endPos = doc.validatePosition(pos.translate(0, action.selectLength));
    this.currentEditor.selection = new vscode.Selection(pos, endPos);
    this.currentEditor.revealRange(new vscode.Range(pos, endPos));
  }

  private async handleThink(durationMs: number, signal: AbortSignal): Promise<void> {
    this.transitionTo(EngineState.PREPARING);
    await createCancellableDelay(durationMs, signal);
    this.transitionTo(EngineState.TYPING);
  }

  private async handleTypeText(text: string): Promise<void> {
    if (!this.currentEditor) { return; }
    await this.typingEngine.typeContent(this.currentEditor, text);
  }

  private async handleBackspace(count: number, signal: AbortSignal): Promise<void> {
    if (!this.currentEditor) { return; }
    for (let c = 0; c < count && !signal.aborted; c++) {
      await vscode.commands.executeCommand('deleteLeft');
      await createCancellableDelay(BACKSPACE_INTERVAL_MS, signal);
    }
  }

  private async handleRevision(start: CodePosition, end?: CodePosition, replacement = ''): Promise<void> {
    if (!this.currentEditor) { return; }
    const startPos = new vscode.Position(start.line, start.character);
    const endPos = end ? new vscode.Position(end.line, end.character) : startPos;
    await this.documentController.replaceRange(
      this.currentEditor,
      new vscode.Range(startPos, endPos),
      replacement
    );
  }

  private async handleRunTerminal(command: string, signal: AbortSignal): Promise<void> {
    await this.saveCurrentFile();
    this.transitionTo(EngineState.EXECUTING);
    await this.terminalEngine.executeCommand(
      {
        command,
        cwd: '.',
        waitForCompletion: true,
        timeout: this.commandTimeout,
        onFailure: ErrorOnFailure.CONTINUE,
      },
      signal
    );
    this.transitionTo(EngineState.TYPING);
  }

  private async saveCurrentFile(): Promise<void> {
    if (!this.currentEditor) { return; }
    await this.documentController.save(this.currentEditor);
  }

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    if (signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }
    while (this.paused) { await createCancellableDelay(PAUSE_POLL_MS, signal); }
  }

  private transitionTo(newState: EngineState): void {
    if (this.state === newState) { return; }
    this.state = newState;
    this.stateListeners.forEach(listener => listener(newState));
  }
}
