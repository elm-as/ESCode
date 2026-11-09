"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypingEngine = void 0;
const types_1 = require("../types");
const ErrorEngine_1 = require("./ErrorEngine");
const CorrectionEngine_1 = require("./CorrectionEngine");
const manual_keystrokes_1 = require("./manual-keystrokes");
const human_pause_1 = require("./human-pause");
const cursor_controller_1 = require("../vscode/cursor-controller");
const safe_editor_1 = require("../vscode/safe-editor");
const random_1 = require("../infrastructure/random");
/** Pause shown after the cursor jumps to a typo, before it gets fixed. */
const CORRECTION_LOOK_MS = 60;
const PAUSE_POLL_MS = 100;
/**
 * Types a piece of content into an editor, character by character, starting
 * at the editor's cursor. Keeps an explicit insertion head so the same engine
 * can append to a file (replay mode) or write in the middle of one (cognitive
 * mode), and so corrections before the head keep it aligned.
 */
class TypingEngine {
    phase = types_1.EngineState.IDLE;
    paused = false;
    skipRequested = false;
    abortController;
    cursorController = new cursor_controller_1.CursorController();
    keystrokes = new manual_keystrokes_1.ManualKeystrokeSource();
    stateListeners = [];
    typingConfig;
    errorConfig;
    errorEngine;
    correctionEngine;
    rng;
    editor;
    content = '';
    charIndex = 0;
    /** Document offset where the next character goes */
    head = 0;
    totalErrors = 0;
    totalCorrections = 0;
    getState() { return this.paused ? types_1.EngineState.PAUSED : this.phase; }
    getCharIndex() { return this.charIndex; }
    getTotalErrors() { return this.totalErrors; }
    getTotalCorrections() { return this.totalCorrections; }
    isConfigured() { return this.typingConfig !== undefined; }
    addStateListener(listener) {
        this.stateListeners.push(listener);
    }
    configure(typingConfig, errorConfig) {
        this.typingConfig = typingConfig;
        this.errorConfig = errorConfig;
        this.errorEngine = new ErrorEngine_1.ErrorEngine(errorConfig);
        this.correctionEngine = new CorrectionEngine_1.CorrectionEngine(errorConfig);
        this.rng = new random_1.SeededRandom(errorConfig.deterministicMode ? errorConfig.seed + 100 : Date.now());
    }
    /**
     * Types `content` at the editor's current cursor position.
     * Resolves when the content is fully written (or skipped / cancelled);
     * pending corrections are always applied before resolving.
     */
    async typeContent(editor, content) {
        if (!this.typingConfig) {
            throw new Error('TypingEngine.configure() must be called before typing');
        }
        this.editor = new safe_editor_1.SafeEditor(editor);
        this.content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        this.charIndex = 0;
        this.head = editor.document.offsetAt(editor.selection.active);
        this.skipRequested = false;
        this.correctionEngine?.clear();
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        this.setPhase(types_1.EngineState.TYPING);
        try {
            if (this.typingConfig.mode === types_1.TypingMode.MANUAL) {
                await this.runManualMode(signal);
            }
            else {
                await this.runAutoMode(signal);
            }
            await this.finishContent(signal);
            this.setPhase(types_1.EngineState.COMPLETED);
        }
        catch (err) {
            if (!(0, random_1.isAbortError)(err)) {
                this.setPhase(types_1.EngineState.ERROR);
                throw err;
            }
            this.setPhase(types_1.EngineState.CANCELLED);
        }
    }
    // ── Main loops ────────────────────────────────────────────
    async runAutoMode(signal) {
        while (this.hasMoreToType()) {
            await this.waitWhilePaused(signal);
            await this.typeNextCharacter(signal);
            await this.maybeHumanPause(signal);
            await (0, random_1.createCancellableDelay)((0, human_pause_1.computeKeystrokeDelay)(this.typingConfig, this.rng), signal);
        }
    }
    async runManualMode(signal) {
        this.keystrokes.start();
        try {
            while (this.hasMoreToType()) {
                await this.waitWhilePaused(signal);
                await this.keystrokes.next(signal);
                if (this.skipRequested) {
                    break;
                }
                await this.typeNextCharacter(signal);
            }
        }
        finally {
            this.keystrokes.stop();
        }
    }
    hasMoreToType() {
        return !this.skipRequested && this.charIndex < this.content.length;
    }
    /** A human re-reads before moving on: fix leftovers, or dump the rest on skip. */
    async finishContent(signal) {
        const visible = !this.skipRequested;
        let action = this.correctionEngine?.flushNext() ?? null;
        while (action) {
            await this.performCorrection(action, { signal, visible });
            action = this.correctionEngine.flushNext();
        }
        if (this.charIndex < this.content.length) {
            await this.insertAtHead(this.content.slice(this.charIndex));
            this.charIndex = this.content.length;
        }
    }
    // ── Character insertion ───────────────────────────────────
    async typeNextCharacter(signal) {
        const error = this.errorEngine?.maybeGenerateError(this.content, this.charIndex, this.errorConfig.rate);
        if (error) {
            await this.typeErroneousText(error);
        }
        else {
            await this.insertAtHead(this.content[this.charIndex]);
            this.charIndex++;
        }
        const action = this.correctionEngine?.tick();
        if (action) {
            await this.performCorrection(action, { signal, visible: true });
        }
    }
    async typeErroneousText(error) {
        const errorPosition = this.head;
        const applied = error.errorChar === '' || (await this.insertAtHead(error.errorChar));
        this.charIndex++;
        this.totalErrors++;
        if (applied) {
            this.queueCorrection(error, errorPosition);
        }
    }
    async insertAtHead(text) {
        const result = await this.editor.insertAt(this.head, text);
        this.head += result.lengthDelta;
        this.moveCursorToHead();
        return result.applied;
    }
    queueCorrection(error, errorPosition) {
        if (!this.errorConfig.correctionEnabled || !this.correctionEngine) {
            return;
        }
        const pending = this.errorEngine.toPendingError(error);
        this.correctionEngine.addError({ ...pending, position: errorPosition });
    }
    // ── Corrections ───────────────────────────────────────────
    async performCorrection(action, options) {
        const docLength = this.editor.document.getText().length;
        if (action.position < 0 || action.position > docLength) {
            return;
        }
        if (options.visible) {
            this.setPhase(types_1.EngineState.CORRECTING);
            await (0, random_1.createCancellableDelay)(action.delay, options.signal);
            this.cursorController.moveToOffset(this.editor.textEditor, action.position);
            await (0, random_1.createCancellableDelay)(CORRECTION_LOOK_MS, options.signal);
        }
        const result = await this.editor.replaceAt(action.position, action.deleteCount, action.insertText);
        if (result.applied) {
            this.totalCorrections++;
            this.correctionEngine.notifyCorrectionApplied(action, result.lengthDelta);
            // Corrections always target text already typed, i.e. before the head
            this.head += result.lengthDelta;
        }
        this.moveCursorToHead();
        if (options.visible) {
            this.setPhase(types_1.EngineState.TYPING);
        }
    }
    // ── Timing ────────────────────────────────────────────────
    async waitWhilePaused(signal) {
        if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        while (this.paused) {
            await (0, random_1.createCancellableDelay)(PAUSE_POLL_MS, signal);
        }
    }
    async maybeHumanPause(signal) {
        if (!this.typingConfig.humanPauses || !this.rng) {
            return;
        }
        const justTyped = this.content[this.charIndex - 1];
        const remaining = this.content.slice(this.charIndex);
        const pauseMs = (0, human_pause_1.computeHumanPause)(justTyped, remaining, this.typingConfig.pauseProbability, this.rng);
        if (pauseMs > 0) {
            await (0, random_1.createCancellableDelay)(pauseMs, signal);
        }
    }
    moveCursorToHead() {
        this.cursorController.moveToOffset(this.editor.textEditor, this.head);
    }
    // ── Session controls ──────────────────────────────────────
    /** Pausing is sticky: it also holds the next content until resume(). */
    pause() {
        if (this.paused) {
            return;
        }
        this.paused = true;
        this.emitState();
    }
    resume() {
        if (!this.paused) {
            return;
        }
        this.paused = false;
        this.emitState();
    }
    /** Finish the current content instantly (pending corrections included). */
    skip() {
        this.skipRequested = true;
        this.paused = false;
        this.keystrokes.wake();
    }
    cancel() {
        this.abortController?.abort();
        this.paused = false;
        this.keystrokes.stop();
    }
    resetStatistics() {
        this.totalErrors = 0;
        this.totalCorrections = 0;
        this.resetPosition();
    }
    /** Forget the previous content's position so progress doesn't count it twice. */
    resetPosition() {
        this.charIndex = 0;
    }
    reset() {
        this.cancel();
        this.resetStatistics();
        this.correctionEngine?.clear();
        this.setPhase(types_1.EngineState.IDLE);
    }
    setPhase(phase) {
        if (this.phase === phase) {
            return;
        }
        this.phase = phase;
        this.emitState();
    }
    emitState() {
        const state = this.getState();
        for (const listener of this.stateListeners) {
            listener(state);
        }
    }
}
exports.TypingEngine = TypingEngine;
//# sourceMappingURL=TypingEngine.js.map