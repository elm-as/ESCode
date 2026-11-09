import * as vscode from 'vscode';
import {
  EngineState,
  TypingConfig,
  ErrorConfig,
  TypingMode,
  GeneratedError,
  CorrectionAction,
} from '../types';
import { ErrorEngine } from './ErrorEngine';
import { CorrectionEngine } from './CorrectionEngine';
import { ManualKeystrokeSource } from './manual-keystrokes';
import { computeHumanPause, computeKeystrokeDelay } from './human-pause';
import { CursorController } from '../vscode/cursor-controller';
import { SafeEditor } from '../vscode/safe-editor';
import { SeededRandom, createCancellableDelay, isAbortError } from '../infrastructure/random';

/** Pause shown after the cursor jumps to a typo, before it gets fixed. */
const CORRECTION_LOOK_MS = 60;
const PAUSE_POLL_MS = 100;

export type StateListener = (state: EngineState) => void;

/**
 * Types a piece of content into an editor, character by character, starting
 * at the editor's cursor. Keeps an explicit insertion head so the same engine
 * can append to a file (replay mode) or write in the middle of one (cognitive
 * mode), and so corrections before the head keep it aligned.
 */
export class TypingEngine {
  private phase: EngineState = EngineState.IDLE;
  private paused = false;
  private skipRequested = false;
  private abortController: AbortController | undefined;
  private readonly cursorController = new CursorController();
  private readonly keystrokes = new ManualKeystrokeSource();
  private readonly stateListeners: StateListener[] = [];

  private typingConfig: TypingConfig | undefined;
  private errorConfig: ErrorConfig | undefined;
  private errorEngine: ErrorEngine | undefined;
  private correctionEngine: CorrectionEngine | undefined;
  private rng: SeededRandom | undefined;

  private editor: SafeEditor | undefined;
  private content = '';
  private charIndex = 0;
  /** Document offset where the next character goes */
  private head = 0;

  private totalErrors = 0;
  private totalCorrections = 0;

  getState(): EngineState { return this.paused ? EngineState.PAUSED : this.phase; }
  getCharIndex(): number { return this.charIndex; }
  getTotalErrors(): number { return this.totalErrors; }
  getTotalCorrections(): number { return this.totalCorrections; }
  isConfigured(): boolean { return this.typingConfig !== undefined; }

  addStateListener(listener: StateListener): void {
    this.stateListeners.push(listener);
  }

  configure(typingConfig: TypingConfig, errorConfig: ErrorConfig): void {
    this.typingConfig = typingConfig;
    this.errorConfig = errorConfig;
    this.errorEngine = new ErrorEngine(errorConfig);
    this.correctionEngine = new CorrectionEngine(errorConfig);
    this.rng = new SeededRandom(
      errorConfig.deterministicMode ? errorConfig.seed + 100 : Date.now()
    );
  }

  /**
   * Types `content` at the editor's current cursor position.
   * Resolves when the content is fully written (or skipped / cancelled);
   * pending corrections are always applied before resolving.
   */
  async typeContent(editor: vscode.TextEditor, content: string): Promise<void> {
    if (!this.typingConfig) {
      throw new Error('TypingEngine.configure() must be called before typing');
    }
    this.editor = new SafeEditor(editor);
    this.content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    this.charIndex = 0;
    this.head = editor.document.offsetAt(editor.selection.active);
    this.skipRequested = false;
    this.correctionEngine?.clear();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.setPhase(EngineState.TYPING);
    try {
      if (this.typingConfig.mode === TypingMode.MANUAL) {
        await this.runManualMode(signal);
      } else {
        await this.runAutoMode(signal);
      }
      await this.finishContent(signal);
      this.setPhase(EngineState.COMPLETED);
    } catch (err) {
      if (!isAbortError(err)) {
        this.setPhase(EngineState.ERROR);
        throw err;
      }
      this.setPhase(EngineState.CANCELLED);
    }
  }

  // ── Main loops ────────────────────────────────────────────

  private async runAutoMode(signal: AbortSignal): Promise<void> {
    while (this.hasMoreToType()) {
      await this.waitWhilePaused(signal);
      await this.typeNextCharacter(signal);
      await this.maybeHumanPause(signal);
      await createCancellableDelay(computeKeystrokeDelay(this.typingConfig!, this.rng!), signal);
    }
  }

  private async runManualMode(signal: AbortSignal): Promise<void> {
    this.keystrokes.start();
    try {
      while (this.hasMoreToType()) {
        await this.waitWhilePaused(signal);
        await this.keystrokes.next(signal);
        if (this.skipRequested) { break; }
        await this.typeNextCharacter(signal);
      }
    } finally {
      this.keystrokes.stop();
    }
  }

  private hasMoreToType(): boolean {
    return !this.skipRequested && this.charIndex < this.content.length;
  }

  /** A human re-reads before moving on: fix leftovers, or dump the rest on skip. */
  private async finishContent(signal: AbortSignal): Promise<void> {
    const visible = !this.skipRequested;
    let action = this.correctionEngine?.flushNext() ?? null;
    while (action) {
      await this.performCorrection(action, { signal, visible });
      action = this.correctionEngine!.flushNext();
    }
    if (this.charIndex < this.content.length) {
      await this.insertAtHead(this.content.slice(this.charIndex));
      this.charIndex = this.content.length;
    }
  }

  // ── Character insertion ───────────────────────────────────

  private async typeNextCharacter(signal: AbortSignal): Promise<void> {
    const error = this.errorEngine?.maybeGenerateError(
      this.content, this.charIndex, this.errorConfig!.rate
    );
    if (error) {
      await this.typeErroneousText(error);
    } else {
      await this.insertAtHead(this.content[this.charIndex]);
      this.charIndex++;
    }

    const action = this.correctionEngine?.tick();
    if (action) { await this.performCorrection(action, { signal, visible: true }); }
  }

  private async typeErroneousText(error: GeneratedError): Promise<void> {
    const errorPosition = this.head;
    const applied = error.errorChar === '' || (await this.insertAtHead(error.errorChar));
    this.charIndex++;
    this.totalErrors++;
    if (applied) { this.queueCorrection(error, errorPosition); }
  }

  private async insertAtHead(text: string): Promise<boolean> {
    const result = await this.editor!.insertAt(this.head, text);
    this.head += result.lengthDelta;
    this.moveCursorToHead();
    return result.applied;
  }

  private queueCorrection(error: GeneratedError, errorPosition: number): void {
    if (!this.errorConfig!.correctionEnabled || !this.correctionEngine) { return; }
    const pending = this.errorEngine!.toPendingError(error);
    this.correctionEngine.addError({ ...pending, position: errorPosition });
  }

  // ── Corrections ───────────────────────────────────────────

  private async performCorrection(
    action: CorrectionAction,
    options: { signal: AbortSignal; visible: boolean }
  ): Promise<void> {
    const docLength = this.editor!.document.getText().length;
    if (action.position < 0 || action.position > docLength) { return; }

    if (options.visible) {
      this.setPhase(EngineState.CORRECTING);
      await createCancellableDelay(action.delay, options.signal);
      this.cursorController.moveToOffset(this.editor!.textEditor, action.position);
      await createCancellableDelay(CORRECTION_LOOK_MS, options.signal);
    }

    const result = await this.editor!.replaceAt(action.position, action.deleteCount, action.insertText);
    if (result.applied) {
      this.totalCorrections++;
      this.correctionEngine!.notifyCorrectionApplied(action, result.lengthDelta);
      // Corrections always target text already typed, i.e. before the head
      this.head += result.lengthDelta;
    }

    this.moveCursorToHead();
    if (options.visible) { this.setPhase(EngineState.TYPING); }
  }

  // ── Timing ────────────────────────────────────────────────

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    if (signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }
    while (this.paused) { await createCancellableDelay(PAUSE_POLL_MS, signal); }
  }

  private async maybeHumanPause(signal: AbortSignal): Promise<void> {
    if (!this.typingConfig!.humanPauses || !this.rng) { return; }
    const justTyped = this.content[this.charIndex - 1];
    const remaining = this.content.slice(this.charIndex);
    const pauseMs = computeHumanPause(justTyped, remaining, this.typingConfig!.pauseProbability, this.rng);
    if (pauseMs > 0) { await createCancellableDelay(pauseMs, signal); }
  }

  private moveCursorToHead(): void {
    this.cursorController.moveToOffset(this.editor!.textEditor, this.head);
  }

  // ── Session controls ──────────────────────────────────────

  /** Pausing is sticky: it also holds the next content until resume(). */
  pause(): void {
    if (this.paused) { return; }
    this.paused = true;
    this.emitState();
  }

  resume(): void {
    if (!this.paused) { return; }
    this.paused = false;
    this.emitState();
  }

  /** Finish the current content instantly (pending corrections included). */
  skip(): void {
    this.skipRequested = true;
    this.paused = false;
    this.keystrokes.wake();
  }

  cancel(): void {
    this.abortController?.abort();
    this.paused = false;
    this.keystrokes.stop();
  }

  resetStatistics(): void {
    this.totalErrors = 0;
    this.totalCorrections = 0;
    this.resetPosition();
  }

  /** Forget the previous content's position so progress doesn't count it twice. */
  resetPosition(): void {
    this.charIndex = 0;
  }

  reset(): void {
    this.cancel();
    this.resetStatistics();
    this.correctionEngine?.clear();
    this.setPhase(EngineState.IDLE);
  }

  private setPhase(phase: EngineState): void {
    if (this.phase === phase) { return; }
    this.phase = phase;
    this.emitState();
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.stateListeners) { listener(state); }
  }
}
