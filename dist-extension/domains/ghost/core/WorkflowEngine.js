"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const TypingEngine_1 = require("./TypingEngine");
const TerminalEngine_1 = require("./TerminalEngine");
const ProjectEngine_1 = require("./ProjectEngine");
const overwrite_policy_1 = require("./overwrite-policy");
const session_resume_1 = require("./session-resume");
const workflow_progress_1 = require("./workflow-progress");
const document_controller_1 = require("../vscode/document-controller");
const logger_1 = require("../infrastructure/logger");
const project_paths_1 = require("../infrastructure/project-paths");
const random_1 = require("../infrastructure/random");
const ActionPlayer_1 = require("../intelligence/actions/ActionPlayer");
const DevelopmentTrajectoryBuilder_1 = require("../intelligence/planning/DevelopmentTrajectoryBuilder");
const PROGRESS_INTERVAL_MS = 250;
const PAUSE_POLL_MS = 100;
/** Sub-engine states worth showing; their terminal states are the workflow's call. */
const ACTIVITY_STATES = new Set([
    types_1.EngineState.PREPARING, types_1.EngineState.TYPING, types_1.EngineState.CORRECTING, types_1.EngineState.EXECUTING,
]);
const FINAL_STATES = new Set([
    types_1.EngineState.IDLE, types_1.EngineState.COMPLETED, types_1.EngineState.CANCELLED, types_1.EngineState.ERROR,
]);
/**
 * Top-level orchestrator of a typing session, in either:
 * - 'replay' mode: files typed one after the other, with optional commands
 * - 'cognitive' mode: a non-linear development trajectory (ActionPlayer)
 * It owns the session state; sub-engines only report activity.
 */
class WorkflowEngine {
    typingEngine = new TypingEngine_1.TypingEngine();
    terminalEngine = new TerminalEngine_1.TerminalEngine();
    projectEngine = new ProjectEngine_1.ProjectEngine();
    documentController = new document_controller_1.DocumentController();
    actionPlayer;
    trajectoryBuilder = new DevelopmentTrajectoryBuilder_1.DevelopmentTrajectoryBuilder();
    logger = logger_1.Logger.getInstance();
    persistence;
    config;
    simulationMode = 'replay';
    state = types_1.EngineState.IDLE;
    paused = false;
    abortController;
    runningSession;
    startTime = 0;
    steps = [];
    currentStepIndex = 0;
    actions = [];
    currentActionIndex = 0;
    progressListeners = [];
    stateListeners = [];
    progressInterval;
    constructor() {
        this.actionPlayer = new ActionPlayer_1.ActionPlayer(this.typingEngine, this.terminalEngine, this.documentController);
        this.actionPlayer.setFilePreparer(editor => (0, overwrite_policy_1.prepareEditorForTyping)(editor, this.config?.overwriteStrategy ?? types_1.OverwriteStrategy.ASK, this.documentController));
        this.actionPlayer.addActionListener((_action, index) => { this.currentActionIndex = index; });
        this.typingEngine.addStateListener(state => this.forwardActivityState(state));
        this.actionPlayer.addStateListener(state => this.forwardActivityState(state));
    }
    getProjectEngine() { return this.projectEngine; }
    getState() { return this.state; }
    getSimulationMode() { return this.simulationMode; }
    isRunning() { return !FINAL_STATES.has(this.state); }
    setPersistence(persistence) {
        this.persistence = persistence;
        this.simulationMode = persistence.getSimulationMode();
    }
    setSimulationMode(mode) {
        this.simulationMode = mode;
        void this.persistence?.saveSimulationMode(mode);
        this.logger.info(`Simulation mode changed to: ${mode}`);
    }
    addProgressListener(listener) {
        this.progressListeners.push(listener);
    }
    addStateListener(listener) {
        this.stateListeners.push(listener);
    }
    addActionListener(listener) {
        this.actionPlayer.addActionListener(listener);
    }
    /** Explicit configuration (from the panel). Otherwise settings are read at start. */
    configure(config) {
        this.config = config;
    }
    // ── Session lifecycle ──────────────────────────────────
    /** Starts a session; resolves when it ends. Never throws. */
    start() {
        if (this.isRunning()) {
            this.logger.warn('A session is already running');
            return this.runningSession ?? Promise.resolve();
        }
        this.runningSession = this.runSession();
        return this.runningSession;
    }
    pause() {
        if (!this.isRunning() || this.paused) {
            return;
        }
        this.paused = true;
        this.typingEngine.pause();
        this.actionPlayer.pause();
        this.transitionTo(types_1.EngineState.PAUSED);
    }
    resume() {
        if (!this.paused) {
            return;
        }
        this.paused = false;
        this.typingEngine.resume();
        this.actionPlayer.resume();
        this.transitionTo(types_1.EngineState.TYPING);
    }
    stop() {
        if (!this.isRunning()) {
            return;
        }
        this.abortController?.abort();
        this.paused = false;
        this.typingEngine.cancel();
        this.actionPlayer.stop();
    }
    /** Replay: finish the current file instantly. Cognitive: the current snippet. */
    skipCurrentFile() {
        if (this.isRunning()) {
            this.typingEngine.skip();
        }
    }
    async restart() {
        this.stop();
        await this.runningSession;
        await this.persistence?.clearSession();
        await this.start();
    }
    async runSession() {
        const config = this.resolveConfig();
        if (!config) {
            return;
        }
        this.typingEngine.configure(config.typing, config.error);
        this.typingEngine.resetStatistics();
        this.actionPlayer.setCommandTimeout(config.commandTimeout);
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        this.paused = false;
        this.startTime = Date.now();
        this.transitionTo(types_1.EngineState.PREPARING);
        this.startProgressReporting();
        try {
            if (this.simulationMode === 'cognitive') {
                await this.runCognitive(config);
            }
            else {
                await this.runReplay(config, signal);
            }
            const completed = !signal.aborted;
            this.transitionTo(completed ? types_1.EngineState.COMPLETED : types_1.EngineState.CANCELLED);
            if (completed) {
                await this.persistence?.clearSession();
            }
        }
        catch (err) {
            this.handleSessionError(err);
        }
        finally {
            this.stopProgressReporting();
            this.emitProgress();
        }
    }
    handleSessionError(err) {
        if ((0, random_1.isAbortError)(err)) {
            this.transitionTo(types_1.EngineState.CANCELLED);
            return;
        }
        this.logger.error('Workflow error', err);
        this.transitionTo(types_1.EngineState.ERROR);
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`FakeCoder: ${message}`);
    }
    /** Panel configuration if any, else user settings + first workspace folder. */
    resolveConfig() {
        if (this.projectEngine.getEnabledFiles().length === 0) {
            void vscode.window.showWarningMessage('FakeCoder: import a project in the FakeCoder panel first.');
            return undefined;
        }
        if (this.config) {
            return this.config;
        }
        const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!projectRoot || !this.persistence) {
            void vscode.window.showWarningMessage('FakeCoder: open a folder first — files are written into it.');
            return undefined;
        }
        this.config = this.persistence.readSessionConfig(projectRoot);
        return this.config;
    }
    // ── Replay mode ────────────────────────────────────────
    async runReplay(config, signal) {
        this.steps = this.projectEngine.buildWorkflow(config.autoExecuteCommands ? { timeout: config.commandTimeout } : undefined);
        const startIndex = await (0, session_resume_1.chooseResumeStep)(this.persistence, this.steps, this.projectEngine.computeProjectSignature());
        for (let i = startIndex; i < this.steps.length && !signal.aborted; i++) {
            this.currentStepIndex = i;
            this.typingEngine.resetPosition();
            await this.waitWhilePaused(signal);
            await this.saveSessionState();
            const isResumedFile = i === startIndex && startIndex > 0;
            await this.executeStep(this.steps[i], { config, signal, isResumedFile });
        }
    }
    async executeStep(step, context) {
        if (step.type === types_1.WorkflowStepType.WRITE_FILE && step.file) {
            const editor = await this.documentController.createAndOpenFile((0, project_paths_1.resolveProjectPath)(context.config.projectRoot, step.file.path));
            // A resumed file only holds a partial, possibly typo-ridden draft
            const strategy = context.isResumedFile
                ? types_1.OverwriteStrategy.REPLACE
                : step.file.overwriteStrategy ?? context.config.overwriteStrategy;
            if (!(await (0, overwrite_policy_1.prepareEditorForTyping)(editor, strategy, this.documentController))) {
                return;
            }
            await this.typingEngine.typeContent(editor, step.file.content);
            await this.documentController.save(editor);
        }
        else if (step.type === types_1.WorkflowStepType.RUN_COMMAND && step.command) {
            this.transitionTo(types_1.EngineState.EXECUTING);
            await this.terminalEngine.executeCommand(step.command, context.signal);
        }
        else if (step.type === types_1.WorkflowStepType.WAIT) {
            this.transitionTo(types_1.EngineState.WAITING_TERMINAL);
            await (0, random_1.createCancellableDelay)(step.waitDuration ?? 1000, context.signal);
        }
    }
    async saveSessionState() {
        const snapshot = this.buildSnapshot();
        if (!this.persistence || !snapshot.currentFile) {
            return;
        }
        await this.persistence.saveSession((0, session_resume_1.buildSessionState)({
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
    async runCognitive(config) {
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
    async waitWhilePaused(signal) {
        while (this.paused) {
            await (0, random_1.createCancellableDelay)(PAUSE_POLL_MS, signal);
        }
    }
    forwardActivityState(state) {
        if (this.paused || !this.isRunning() || !ACTIVITY_STATES.has(state)) {
            return;
        }
        this.transitionTo(state);
    }
    transitionTo(newState) {
        if (this.state === newState) {
            return;
        }
        this.state = newState;
        this.stateListeners.forEach(listener => listener(newState));
    }
    startProgressReporting() {
        this.stopProgressReporting();
        this.progressInterval = setInterval(() => this.emitProgress(), PROGRESS_INTERVAL_MS);
    }
    stopProgressReporting() {
        if (!this.progressInterval) {
            return;
        }
        clearInterval(this.progressInterval);
        this.progressInterval = undefined;
    }
    buildSnapshot() {
        const charIndex = this.typingEngine.getCharIndex();
        return this.simulationMode === 'cognitive'
            ? (0, workflow_progress_1.snapshotCognitive)(this.actions, this.currentActionIndex, charIndex)
            : (0, workflow_progress_1.snapshotReplay)(this.steps, this.currentStepIndex, charIndex);
    }
    emitProgress() {
        if (this.progressListeners.length === 0) {
            return;
        }
        const progress = (0, workflow_progress_1.computeProgress)(this.buildSnapshot(), {
            elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
            totalErrors: this.typingEngine.getTotalErrors(),
            totalCorrections: this.typingEngine.getTotalCorrections(),
            state: this.state,
        });
        this.progressListeners.forEach(listener => listener(progress));
    }
    dispose() {
        this.stop();
        this.stopProgressReporting();
        this.terminalEngine.dispose();
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=WorkflowEngine.js.map