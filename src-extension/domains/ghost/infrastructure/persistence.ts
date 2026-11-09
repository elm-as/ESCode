import * as vscode from 'vscode';
import {
  SessionState,
  TypingConfig,
  ErrorConfig,
  TypingMode,
  CorrectionDelay,
  OverwriteStrategy,
  ProjectFile,
  SimulationMode,
  SessionConfig,
} from '../types';
import { Logger } from './logger';

const SESSION_KEY = 'fakecoder.session';
const PROJECT_KEY = 'fakecoder.project';
const SIMULATION_MODE_KEY = 'fakecoder.simulationMode';

/**
 * Reads/writes FakeCoder configuration and session state via VS Code APIs.
 * Isolated so no other module needs to depend on vscode.workspace.getConfiguration directly.
 */
export class Persistence {
  private readonly logger = Logger.getInstance();

  constructor(private readonly context: vscode.ExtensionContext) {}

  // ── Session & project (workspace state) ──────────────

  async saveSession(session: SessionState): Promise<void> {
    await this.updateState(SESSION_KEY, session);
  }

  getSession(): SessionState | undefined {
    return this.context.workspaceState.get<SessionState>(SESSION_KEY);
  }

  async clearSession(): Promise<void> {
    await this.updateState(SESSION_KEY, undefined);
  }

  /** The loaded project is kept so an interrupted session survives a restart. */
  async saveProject(files: ProjectFile[]): Promise<void> {
    await this.updateState(PROJECT_KEY, files);
  }

  getProject(): ProjectFile[] {
    return this.context.workspaceState.get<ProjectFile[]>(PROJECT_KEY) ?? [];
  }

  async saveSimulationMode(mode: SimulationMode): Promise<void> {
    await this.updateState(SIMULATION_MODE_KEY, mode);
  }

  getSimulationMode(): SimulationMode {
    return this.context.workspaceState.get<SimulationMode>(SIMULATION_MODE_KEY) ?? 'replay';
  }

  // ── Settings ─────────────────────────────────────────

  /** Full session configuration from user settings. */
  readSessionConfig(projectRoot: string): SessionConfig {
    return {
      typing: this.readTypingConfig(),
      error: this.readErrorConfig(),
      overwriteStrategy: this.readOverwriteStrategy(),
      projectRoot,
      autoExecuteCommands: this.readAutoExecuteCommands(),
      commandTimeout: this.readCommandTimeout(),
    };
  }

  readTypingConfig(): TypingConfig {
    const cfg = vscode.workspace.getConfiguration('fakecoder');
    return {
      mode: cfg.get<string>('typingMode', 'manual') as TypingMode,
      speed: cfg.get<number>('speed', 14),
      minDelay: cfg.get<number>('minDelay', 18),
      maxDelay: cfg.get<number>('maxDelay', 260),
      randomness: cfg.get<number>('randomness', 25),
      humanPauses: cfg.get<boolean>('humanPauses', true),
      pauseProbability: cfg.get<number>('pauseProbability', 15),
    };
  }

  readErrorConfig(): ErrorConfig {
    const cfg = vscode.workspace.getConfiguration('fakecoder');
    return {
      rate: cfg.get<number>('errorRate', 4),
      keyboardLayout: cfg.get<string>('keyboardLayout', 'azerty'),
      correctionEnabled: cfg.get<boolean>('correctionEnabled', true),
      correctionDelay: cfg.get<string>('correctionDelay', 'short') as CorrectionDelay,
      deterministicMode: cfg.get<boolean>('deterministicMode', false),
      seed: cfg.get<number>('seed', 42),
    };
  }

  /** User additions only — FileScanner always merges its built-in defaults. */
  readExcludedDirectories(): string[] {
    return vscode.workspace.getConfiguration('fakecoder').get<string[]>('excludedDirectories', []);
  }

  readExcludedExtensions(): string[] {
    return vscode.workspace.getConfiguration('fakecoder').get<string[]>('excludedExtensions', []);
  }

  readMaxFileSize(): number {
    return vscode.workspace.getConfiguration('fakecoder').get<number>('maxFileSize', 1048576);
  }

  readOverwriteStrategy(): OverwriteStrategy {
    const value = vscode.workspace.getConfiguration('fakecoder').get<string>('overwriteStrategy', 'ask');
    const known = Object.values(OverwriteStrategy) as string[];
    return known.includes(value) ? value as OverwriteStrategy : OverwriteStrategy.ASK;
  }

  readAutoExecuteCommands(): boolean {
    return vscode.workspace.getConfiguration('fakecoder').get<boolean>('autoExecuteCommands', false);
  }

  readCommandTimeout(): number {
    return vscode.workspace.getConfiguration('fakecoder').get<number>('commandTimeout', 60000);
  }

  private async updateState(key: string, value: unknown): Promise<void> {
    try {
      await this.context.workspaceState.update(key, value);
    } catch (err) {
      this.logger.error(`Failed to persist ${key}`, err);
    }
  }
}
