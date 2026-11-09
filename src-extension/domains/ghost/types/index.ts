// ─── Enums ───────────────────────────────────────────────────────────────────

export enum TypingMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export enum EngineState {
  IDLE = 'idle',
  PREPARING = 'preparing',
  TYPING = 'typing',
  PAUSED = 'paused',
  CORRECTING = 'correcting',
  EXECUTING = 'executing',
  WAITING_TERMINAL = 'waitingTerminal',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

export enum OverwriteStrategy {
  REPLACE = 'replace',
  APPEND = 'append',
  INSERT = 'insert',
  OVERWRITE_FROM_CURSOR = 'overwriteFromCursor',
  CLEAR_THEN_TYPE = 'clearThenType',
  IGNORE = 'ignore',
  ASK = 'ask',
}

export enum ErrorOnFailure {
  STOP = 'stop',
  CONTINUE = 'continue',
  RETRY = 'retry',
  PAUSE = 'pause',
}

export enum CorrectionDelay {
  IMMEDIATE = 'immediate',
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

export enum WorkflowStepType {
  WRITE_FILE = 'writeFile',
  RUN_COMMAND = 'runCommand',
  WAIT = 'wait',
}

export enum ErrorType {
  ADJACENT_KEY = 'adjacentKey',
  OMITTED_CHAR = 'omittedChar',
  REPEATED_CHAR = 'repeatedChar',
  WRONG_CHAR = 'wrongChar',
  MISSING_SPACE = 'missingSpace',
  EXTRA_SPACE = 'extraSpace',
  WRONG_PUNCTUATION = 'wrongPunctuation',
  WRONG_CASE = 'wrongCase',
}

export enum FileCategory {
  CONFIG = 'config',
  PACKAGE_MANAGER = 'packageManager',
  PROJECT_CONFIG = 'projectConfig',
  SOURCE = 'source',
  COMPONENT = 'component',
  STYLE = 'style',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
  OTHER = 'other',
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ProjectFile {
  /** Relative path within the project */
  path: string;
  /** File content */
  content: string;
  /** File size in bytes */
  size: number;
  /** Number of lines */
  lineCount: number;
  /** Whether this file is enabled for writing */
  enabled: boolean;
  /** Display order */
  order: number;
  /** File category for ordering */
  category: FileCategory;
  /** Overwrite strategy specific to this file (overrides global) */
  overwriteStrategy?: OverwriteStrategy;
}

export interface ProjectConfig {
  /** All project files */
  files: ProjectFile[];
  /** Project root path (for imported folders) */
  rootPath?: string;
  /** Custom excluded directories */
  excludedDirectories: string[];
  /** Custom excluded extensions */
  excludedExtensions: string[];
  /** Maximum file size limit */
  maxFileSize: number;
}

export interface TerminalCommand {
  /** Command to execute */
  command: string;
  /** Working directory (relative to project root) */
  cwd: string;
  /** Wait for completion before continuing */
  waitForCompletion: boolean;
  /** Timeout in ms */
  timeout: number;
  /** Behavior on failure */
  onFailure: ErrorOnFailure;
}

export interface WorkflowStep {
  type: WorkflowStepType;
  /** For WRITE_FILE: the file to write */
  file?: ProjectFile;
  /** For RUN_COMMAND: the command to execute */
  command?: TerminalCommand;
  /** For WAIT: duration in ms */
  waitDuration?: number;
}

export interface TypingConfig {
  mode: TypingMode;
  /** Characters per second */
  speed: number;
  /** Minimum delay between characters (ms) */
  minDelay: number;
  /** Maximum delay between characters (ms) */
  maxDelay: number;
  /** Speed randomness percentage (0-100) */
  randomness: number;
  /** Enable human-like pauses */
  humanPauses: boolean;
  /** Probability of micro-pause (0-100) */
  pauseProbability: number;
}

export interface ErrorConfig {
  /** Error rate (0-100) */
  rate: number;
  /** Keyboard layout name */
  keyboardLayout: string;
  /** Enable auto-correction */
  correctionEnabled: boolean;
  /** Correction delay strategy */
  correctionDelay: CorrectionDelay;
  /** Deterministic mode */
  deterministicMode: boolean;
  /** Random seed for deterministic mode */
  seed: number;
}

/** Everything the workflow needs to run a session, resolved before start. */
export interface SessionConfig {
  typing: TypingConfig;
  error: ErrorConfig;
  overwriteStrategy: OverwriteStrategy;
  projectRoot: string;
  /** Queue install commands after dependency manifests (each still needs authorization) */
  autoExecuteCommands: boolean;
  /** How long to wait for a terminal command, in ms */
  commandTimeout: number;
}

export interface ProgressInfo {
  /** Current file being written */
  currentFile: string;
  /** Current file index (0-based) */
  currentFileIndex: number;
  /** Total number of files */
  totalFiles: number;
  /** Characters written in current file */
  charsWritten: number;
  /** Total characters in current file */
  totalChars: number;
  /** File progress percentage */
  fileProgress: number;
  /** Overall progress percentage */
  overallProgress: number;
  /** Current speed (chars/s) */
  currentSpeed: number;
  /** Total errors generated */
  totalErrors: number;
  /** Total corrections performed */
  totalCorrections: number;
  /** Elapsed time in ms */
  elapsedTime: number;
  /** Estimated remaining time in ms */
  estimatedRemainingTime: number;
  /** Current engine state */
  state: EngineState;
}

export interface SessionState {
  /** Fingerprint of the loaded project — a session only resumes on the same project */
  projectSignature: string;
  /** Path of the file being typed when the session was saved */
  currentFilePath: string;
  /** Current file index */
  fileIndex: number;
  /** Character index within the current file */
  charIndex: number;
  /** Engine state at time of save */
  state: EngineState;
  /** Workflow step index */
  workflowStepIndex: number;
  /** Error state */
  pendingErrors: PendingError[];
  /** Total errors so far */
  totalErrors: number;
  /** Total corrections so far */
  totalCorrections: number;
  /** Elapsed time at save */
  elapsedTime: number;
  /** Timestamp of save */
  savedAt: number;
}

export interface PendingError {
  /** Position in the content where the error was introduced */
  position: number;
  /** The correct character */
  correctChar: string;
  /** The wrong character that was typed */
  wrongChar: string;
  /** Type of error */
  errorType: ErrorType;
  /** Number of chars typed after this error (for delayed correction) */
  charsSinceError: number;
}

export interface KeyPosition {
  row: number;
  col: number;
}

export interface KeyboardKey {
  /** The character this key produces */
  char: string;
  /** Physical position on the keyboard */
  position: KeyPosition;
  /** Shifted character */
  shifted?: string;
  /** AltGr character */
  altGr?: string;
}

export interface KeyboardLayoutMap {
  [char: string]: KeyboardKey;
}

export interface GeneratedError {
  /** Type of error */
  type: ErrorType;
  /** The character that should have been typed */
  correctChar: string;
  /** The character that was actually typed (empty for omission) */
  errorChar: string;
  /** Position in the content */
  position: number;
}

export interface CorrectionAction {
  /** Position to correct */
  position: number;
  /** Number of characters to delete */
  deleteCount: number;
  /** Text to insert after deletion */
  insertText: string;
  /** Delay before correction in ms */
  delay: number;
  /** Sequence number of the error being corrected (orders same-offset errors) */
  sequence: number;
}

/** replay: linear file-by-file typing. cognitive: non-linear development trajectory. */
export type SimulationMode = 'replay' | 'cognitive';

// ─── Webview Messages ────────────────────────────────────────────────────────

export type WebviewMessage =
  | { type: 'captureActiveFile' }
  | { type: 'captureWorkspace' }
  | { type: 'importFile' }
  | { type: 'importFiles' }
  | { type: 'importFolder' }
  | { type: 'pasteProject'; data: string }
  | { type: 'pasteCode'; data: string; filename: string }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'restart' }
  | { type: 'skipFile' }
  | { type: 'toggleFile'; path: string; enabled: boolean }
  | { type: 'updateConfig'; config: Partial<TypingConfig & ErrorConfig> }
  | { type: 'setSimulationMode'; mode: SimulationMode }
  | { type: 'ready' };

export type ExtensionMessage =
  | { type: 'projectLoaded'; files: ProjectFile[] }
  | { type: 'progressUpdate'; progress: ProgressInfo }
  | { type: 'stateChange'; state: EngineState }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | { type: 'configLoaded'; typing: TypingConfig; error: ErrorConfig; simulationMode: SimulationMode }
  | { type: 'simulationModeChanged'; mode: SimulationMode }
  | { type: 'cognitiveAction'; actionDescription: string; index: number; total: number; goal?: string };

