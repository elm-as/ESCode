import * as vscode from 'vscode';
import {
  EngineState,
  WorkflowStep,
  WorkflowStepType,
  OverwriteStrategy,
  ProgressInfo,
  SessionConfig,
  SimulationMode,
} from '../types';
import { TypingEngine } from './TypingEngine';
import { TerminalEngine } from './TerminalEngine';
import { ProjectEngine } from './ProjectEngine';
import { prepareEditorForTyping } from './overwrite-policy';
import { chooseResumeStep, buildSessionState } from './session-resume';
import { snapshotCognitive, snapshotReplay, computeProgress, ProgressSnapshot } from './workflow-progress';
import { DocumentController } from '../vscode/document-controller';
import { Logger } from '../infrastructure/logger';
import { Persistence } from '../infrastructure/persistence';
import { resolveProjectPath } from '../infrastructure/project-paths';
import { createCancellableDelay, isAbortError } from '../infrastructure/random';
import { ActionPlayer } from '../intelligence/actions/ActionPlayer';
import { DevelopmentTrajectoryBuilder } from '../intelligence/planning/DevelopmentTrajectoryBuilder';
import { CodingAction } from '../intelligence/actions/action-types';

type ActionListener = (action: CodingAction, index: number, total: number) => void;

const PROGRESS_INTERVAL_MS = 250;
const PAUSE_POLL_MS = 100;
/** Sub-engine states worth showing; their terminal states are the workflow's call. */
const ACTIVITY_STATES = new Set([
  EngineState.PREPARING, EngineState.TYPING, EngineState.CORRECTING, EngineState.EXECUTING,
]);
const FINAL_STATES = new Set([
  EngineState.IDLE, EngineState.COMPLETED, EngineState.CANCELLED, EngineState.ERROR,
]);

/**
 * Top-level orchestrator of a typing session, in either:
 * - 'replay' mode: files typed one after the other, with optional commands
 * - 'cognitive' mode: a non-linear development trajectory (ActionPlayer)
 * It owns the session state; sub-engines only report activity.
 */
export class WorkflowEngine {
  private readonly typingEngine = new TypingEngine();
  private readonly terminalEngine = new TerminalEngine();
  private readonly projectEngine = new ProjectEngine();
  private readonly documentController = new DocumentController();
  private readonly actionPlayer: ActionPlayer;
  private readonly trajectoryBuilder = new DevelopmentTrajectoryBuilder();
  private readonly logger = Logger.getInstance();
  private persistence: Persistence | undefined;

  private config: SessionConfig | undefined;
  private simulationMode: SimulationMode = 'replay';
  private state: EngineState = EngineState.IDLE;
  private paused = false;
  private abortController: AbortController | undefined;
  private runningSession: Promise<void> | undefined;
  private startTime = 0;

  private steps: WorkflowStep[] = [];
  private currentStepIndex = 0;
  private actions: CodingAction[] = [];
  private currentActionIndex = 0;

  private readonly progressListeners: Array<(progress: ProgressInfo) => void> = [];
  private readonly stateListeners: Array<(state: EngineState) => void> = [];
  private progressInterval: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.actionPlayer = new ActionPlayer(this.typingEngine, this.terminalEngine, this.documentController);
    this.actionPlayer.setFilePreparer(editor => prepareEditorForTyping(
      editor, this.config?.overwriteStrategy ?? OverwriteStrategy.ASK, this.documentController
    ));
    this.actionPlayer.addActionListener((_action, index) => { this.currentActionIndex = index; });
    this.typingEngine.addStateListener(state => this.forwardActivityState(state));
    this.actionPlayer.addStateListener(state => this.forwardActivityState(state));
  }

  getProjectEngine(): ProjectEngine { return this.projectEngine; }
  getState(): EngineState { return this.state; }
  getSimulationMode(): SimulationMode { return this.simulationMode; }
  isRunning(): boolean { return !FINAL_STATES.has(this.state); }

  setPersistence(persistence: Persistence): void {
    this.persistence = persistence;
    this.simulationMode = persistence.getSimulationMode();
  }

  setSimulationMode(mode: SimulationMode): void {
    this.simulationMode = mode;
    void this.persistence?.saveSimulationMode(mode);
    this.logger.info(`Simulation mode changed to: ${mode}`);
  }

  addProgressListener(listener: (progress: ProgressInfo) => void): void {
    this.progressListeners.push(listener);
  }

  addStateListener(listener: (state: EngineState) => void): void {
    this.stateListeners.push(listener);
  }

  addActionListener(listener: ActionListener): void {
    this.actionPlayer.addActionListener(listener);
  }

  /** Explicit configuration (from the panel). Otherwise settings are read at start. */
  configure(config: SessionConfig): void {
    this.config = config;
  }

  // ── Session lifecycle ──────────────────────────────────

  /** Starts a session; resolves when it ends. Never throws. */
  start(): Promise<void> {
    if (this.isRunning()) {
      this.logger.warn('A session is already running');
      return this.runningSession ?? Promise.resolve();
    }
    this.runningSession = this.runSession();
    return this.runningSession;
  }

  pause(): void {
    if (!this.isRunning() || this.paused) { return; }
    this.paused = true;
    this.typingEngine.pause();
    this.actionPlayer.pause();
    this.transitionTo(EngineState.PAUSED);
  }

  resume(): void {
    if (!this.paused) { return; }
    this.paused = false;
    this.typingEngine.resume();
    this.actionPlayer.resume();
    this.transitionTo(EngineState.TYPING);
  }

  stop(): void {
    if (!this.isRunning()) { return; }
    this.abortController?.abort();
    this.paused = false;
    this.typingEngine.cancel();
    this.actionPlayer.stop();
  }

  /** Replay: finish the current file instantly. Cognitive: the current snippet. */
  skipCurrentFile(): void {
    if (this.isRunning()) { this.typingEngine.skip(); }
  }

  async restart(): Promise<void> {
    this.stop();
    await this.runningSession;
    await this.persistence?.clearSession();
    await this.start();
  }

  private async runSession(): Promise<void> {
    const config = this.resolveConfig();
    if (!config) { return; }

    this.typingEngine.configure(config.typing, config.error);
    this.typingEngine.resetStatistics();
    this.actionPlayer.setCommandTimeout(config.commandTimeout);
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    this.paused = false;
    this.startTime = Date.now();
    this.transitionTo(EngineState.PREPARING);
    this.startProgressReporting();

    try {
      if (this.simulationMode === 'cognitive') {
        await this.runCognitive(config);
      } else {
        await this.runReplay(config, signal);
      }
      const completed = !signal.aborted;
      this.transitionTo(completed ? EngineState.COMPLETED : EngineState.CANCELLED);
      if (completed) { await this.persistence?.clearSession(); }
    } catch (err) {
      this.handleSessionError(err);
    } finally {
      this.stopProgressReporting();
      this.emitProgress();
    }
  }

  private handleSessionError(err: unknown): void {
    if (isAbortError(err)) {
      this.transitionTo(EngineState.CANCELLED);
      return;
    }
    this.logger.error('Workflow error', err);
    this.transitionTo(EngineState.ERROR);
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`FakeCoder: ${message}`);
  }

  /** Panel configuration if any, else user settings + first workspace folder. */
  private resolveConfig(): SessionConfig | undefined {
    if (this.projectEngine.getEnabledFiles().length === 0) {
      void vscode.window.showWarningMessage('FakeCoder: import a project in the FakeCoder panel first.');
      return undefined;
    }
    if (this.config) { return this.config; }

    const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!projectRoot || !this.persistence) {
      void vscode.window.showWarningMessage('FakeCoder: open a folder first — files are written into it.');
      return undefined;
    }
    this.config = this.persistence.readSessionConfig(projectRoot);
    return this.config;
  }

  // ── Replay mode ────────────────────────────────────────

  private async runReplay(config: SessionConfig, signal: AbortSignal): Promise<void> {
    this.steps = this.projectEngine.buildWorkflow(
      config.autoExecuteCommands ? { timeout: config.commandTimeout } : undefined
    );
    const startIndex = await chooseResumeStep(
      this.persistence, this.steps, this.projectEngine.computeProjectSignature()
    );

    for (let i = startIndex; i < this.steps.length && !signal.aborted; i++) {
      this.currentStepIndex = i;
      this.typingEngine.resetPosition();
      await this.waitWhilePaused(signal);
      await this.saveSessionState();
      const isResumedFile = i === startIndex && startIndex > 0;
      await this.executeStep(this.steps[i], { config, signal, isResumedFile });
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: { config: SessionConfig; signal: AbortSignal; isResumedFile: boolean }
  ): Promise<void> {
    if (step.type === WorkflowStepType.WRITE_FILE && step.file) {
      const editor = await this.documentController.createAndOpenFile(
        resolveProjectPath(context.config.projectRoot, step.file.path)
      );
      // A resumed file only holds a partial, possibly typo-ridden draft
      const strategy = context.isResumedFile
        ? OverwriteStrategy.REPLACE
        : step.file.overwriteStrategy ?? context.config.overwriteStrategy;
      if (!(await prepareEditorForTyping(editor, strategy, this.documentController))) { return; }
      await this.typingEngine.typeContent(editor, step.file.content);
      await this.documentController.save(editor);
    } else if (step.type === WorkflowStepType.RUN_COMMAND && step.command) {
      this.transitionTo(EngineState.EXECUTING);
      await this.terminalEngine.executeCommand(step.command, context.signal);
    } else if (step.type === WorkflowStepType.WAIT) {
      this.transitionTo(EngineState.WAITING_TERMINAL);
      await createCancellableDelay(step.waitDuration ?? 1000, context.signal);
    }
  }

  private async saveSessionState(): Promise<void> {
    const snapshot = this.buildSnapshot();
    if (!this.persistence || !snapshot.currentFile) { return; }
    await this.persistence.saveSession(buildSessionState({
      projectSignature: this.projectEngine.computeProjectSignature(),
      currentFilePath: snapshot.currentFile,
      fileIndex: snapshot.fileIndex,
      workflowStepIndex: this.currentStepIndex,
      state: this.state,
      totalErrors: this.typingEngine.getTotalErrors(),
      totalCorrections: this.typingEngine.getTotalCorrections(),
      elapsedTime: Date.now() - this.startTime,
    }));
  }

  // ── Cognitive mode ─────────────────────────────────────

  private async runCognitive(config: SessionConfig): Promise<void> {
    const documents = this.projectEngine.getEnabledFiles().map(f => ({ path: f.path, content: f.content }));
    this.actions = this.trajectoryBuilder.buildTrajectory(documents, {
      enableThinkingPauses: true,
      enableTerminalCommands: config.autoExecuteCommands,
    });
    this.currentActionIndex = 0;
    this.logger.info(`Generated cognitive trajectory with ${this.actions.length} actions`);
    await this.actionPlayer.play(this.actions, config.projectRoot);
  }

  // ── State & progress ───────────────────────────────────

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    while (this.paused) { await createCancellableDelay(PAUSE_POLL_MS, signal); }
  }

  private forwardActivityState(state: EngineState): void {
    if (this.paused || !this.isRunning() || !ACTIVITY_STATES.has(state)) { return; }
    this.transitionTo(state);
  }

  private transitionTo(newState: EngineState): void {
    if (this.state === newState) { return; }
    this.state = newState;
    this.stateListeners.forEach(listener => listener(newState));
  }

  private startProgressReporting(): void {
    this.stopProgressReporting();
    this.progressInterval = setInterval(() => this.emitProgress(), PROGRESS_INTERVAL_MS);
  }

  private stopProgressReporting(): void {
    if (!this.progressInterval) { return; }
    clearInterval(this.progressInterval);
    this.progressInterval = undefined;
  }

  private buildSnapshot(): ProgressSnapshot {
    const charIndex = this.typingEngine.getCharIndex();
    return this.simulationMode === 'cognitive'
      ? snapshotCognitive(this.actions, this.currentActionIndex, charIndex)
      : snapshotReplay(this.steps, this.currentStepIndex, charIndex);
  }

  private emitProgress(): void {
    if (this.progressListeners.length === 0) { return; }
    const progress = computeProgress(this.buildSnapshot(), {
      elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
      totalErrors: this.typingEngine.getTotalErrors(),
      totalCorrections: this.typingEngine.getTotalCorrections(),
      state: this.state,
    });
    this.progressListeners.forEach(listener => listener(progress));
  }

  dispose(): void {
    this.stop();
    this.stopProgressReporting();
    this.terminalEngine.dispose();
  }
}
