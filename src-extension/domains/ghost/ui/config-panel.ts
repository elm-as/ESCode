import * as path from 'path';
import * as vscode from 'vscode';
import {
  WebviewMessage,
  ExtensionMessage,
  ProjectFile,
  TypingConfig,
  ErrorConfig,
  TypingMode,
  CorrectionDelay,
  OverwriteStrategy,
  EngineState,
} from '../types';
import { WorkflowEngine } from '../core/WorkflowEngine';
import { FileScanner } from '../parser/FileScanner';
import { ProjectParser } from '../parser/ProjectParser';
import { createProjectFile } from '../parser/file-classification';
import { Persistence } from '../infrastructure/persistence';
import { Logger } from '../infrastructure/logger';
import { CodingAction } from '../intelligence/actions/action-types';
import { buildWebviewHtml } from './webview-html';

/**
 * Camouflaged Webview controller ("Inspecteur AST & Flux Syntaxique").
 * Can be rendered either in a sidebar WebviewView or opened on-demand
 * via a stealth shortcut (Ctrl+Alt+K) as a standalone editor tab.
 */
export class ConfigPanel implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'fakecoder.mainView';

  private view: vscode.WebviewView | undefined;
  private modalPanel: vscode.WebviewPanel | undefined;
  private readonly logger = Logger.getInstance();
  private readonly disposables: vscode.Disposable[] = [];

  private typingConfig: TypingConfig;
  private errorConfig: ErrorConfig;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workflow: WorkflowEngine,
    private readonly persistence: Persistence
  ) {
    this.typingConfig = persistence.readTypingConfig();
    this.errorConfig = persistence.readErrorConfig();

    this.workflow.addProgressListener(progress => this.postMessage({ type: 'progressUpdate', progress }));
    this.workflow.addStateListener(state => this.postMessage({ type: 'stateChange', state }));
    this.workflow.addActionListener((action, index, total) => this.postMessage({
      type: 'cognitiveAction', actionDescription: describeAction(action), index, total,
    }));
    this.disposables.push(vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('fakecoder')) { this.reloadSettings(); }
    }));
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.setupWebview(webviewView.webview);
  }

  /** Opens or reveals the camouflaged panel in an editor tab (Ctrl+Alt+K). */
  openOrToggleModalPanel(): void {
    if (this.modalPanel) {
      this.modalPanel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'elmasAstInspector',
      'Inspecteur AST & Flux',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.extensionUri] }
    );
    this.modalPanel = panel;
    this.setupWebview(panel.webview);
    panel.onDidDispose(() => { this.modalPanel = undefined; }, null, this.disposables);
  }

  /**
   * Stealth 1-key toggle (Ctrl+Alt+M):
   * - If typing -> pause
   * - If paused -> resume
   * - If idle -> auto-captures active file if no project is loaded, then starts!
   */
  async toggleQuickSession(forcedMode?: TypingMode): Promise<void> {
    if (forcedMode) {
      this.typingConfig = { ...this.typingConfig, mode: forcedMode };
      this.postConfig();
    }
    const state = this.workflow.getState();
    if (state === EngineState.PAUSED) {
      this.workflow.resume();
      return;
    }
    if (this.workflow.isRunning()) {
      this.workflow.pause();
      return;
    }
    if (this.workflow.getProjectEngine().getEnabledFiles().length === 0) {
      await this.handleCaptureActiveFile();
    }
    this.handleStart();
  }

  dispose(): void {
    this.modalPanel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }

  private setupWebview(webview: vscode.Webview): void {
    webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    webview.html = buildWebviewHtml(webview);
    webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      undefined,
      this.disposables
    );
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    try {
      await this.routeMessage(msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erreur inattendue';
      this.logger.error('Message handling failed', err);
      this.postMessage({ type: 'error', message: errMsg });
    }
  }

  private async routeMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready': return this.handleReady();
      case 'captureActiveFile': return this.handleCaptureActiveFile();
      case 'captureWorkspace': return this.handleCaptureWorkspace();
      case 'importFile': return this.handleImportFiles(false);
      case 'importFiles': return this.handleImportFiles(true);
      case 'importFolder': return this.handleImportFolder();
      case 'pasteProject': return this.loadFiles(new ProjectParser().parseProjectJson(msg.data));
      case 'pasteCode': return this.loadFiles(new ProjectParser().parseRawCode(msg.data, msg.filename));
      case 'start': return this.handleStart();
      case 'pause': return this.workflow.pause();
      case 'resume': return this.workflow.resume();
      case 'stop': return this.workflow.stop();
      case 'restart': return this.workflow.restart();
      case 'skipFile': return this.workflow.skipCurrentFile();
      case 'toggleFile': return this.handleToggleFile(msg.path, msg.enabled);
      case 'updateConfig': return this.applyConfigUpdate(msg.config);
      case 'setSimulationMode':
        this.workflow.setSimulationMode(msg.mode);
        return this.postMessage({ type: 'simulationModeChanged', mode: msg.mode });
    }
  }

  private handleReady(): void {
    this.postConfig();
    const files = this.workflow.getProjectEngine().getFiles();
    if (files.length > 0) { this.postMessage({ type: 'projectLoaded', files }); }
    this.postMessage({ type: 'stateChange', state: this.workflow.getState() });
  }

  /** Captures the currently active editor file (or first visible editor) for instant replay. */
  async handleCaptureActiveFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0];
    if (!editor || editor.document.uri.scheme !== 'file') {
      throw new Error('Ouvrez un fichier code dans l’éditeur avant de capturer.');
    }
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(editor.document.uri.fsPath);
    const relPath = path.relative(root, editor.document.uri.fsPath) || path.basename(editor.document.uri.fsPath);
    const content = editor.document.getText();
    if (!content.trim()) {
      throw new Error('Le fichier actif est vide.');
    }
    const file: ProjectFile = {
      ...createProjectFile(relPath, content),
      overwriteStrategy: OverwriteStrategy.CLEAR_THEN_TYPE,
    };
    await this.loadFiles([file]);
  }

  /** Scans all eligible source files in the active workspace folder. */
  async handleCaptureWorkspace(): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      throw new Error('Aucun dossier de projet ouvert dans l’espace de travail.');
    }
    const scanned = await this.createScanner().scanDirectory(root);
    const withClearStrategy = scanned.map(f => ({
      ...f,
      overwriteStrategy: OverwriteStrategy.CLEAR_THEN_TYPE,
    }));
    await this.loadFiles(withClearStrategy);
  }

  private async handleImportFiles(multi: boolean): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: multi,
      canSelectFiles: true,
      canSelectFolders: false,
      title: multi ? 'Sélectionner des fichiers sources' : 'Sélectionner un fichier source',
    });
    if (!uris || uris.length === 0) { return; }
    await this.loadFiles(await this.createScanner().processFiles(uris.map(u => u.fsPath)));
  }

  private async handleImportFolder(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      title: 'Sélectionner un dossier de projet à importer',
    });
    if (!uris || uris.length === 0) { return; }
    await this.loadFiles(await this.createScanner().scanDirectory(uris[0].fsPath));
  }

  private async loadFiles(files: ProjectFile[]): Promise<void> {
    if (this.workflow.isRunning()) {
      throw new Error('Arrêtez la session en cours avant de charger de nouveaux fichiers.');
    }
    if (files.length === 0) {
      throw new Error('Aucun fichier texte éligible trouvé.');
    }
    this.workflow.getProjectEngine().loadFiles(files);
    await this.persistence.saveProject(files);
    await this.persistence.clearSession();
    this.postMessage({ type: 'projectLoaded', files });
    this.logger.info(`${files.length} files loaded into project`);
  }

  private async handleToggleFile(filePath: string, enabled: boolean): Promise<void> {
    const projectEngine = this.workflow.getProjectEngine();
    projectEngine.toggleFile(filePath, enabled);
    await this.persistence.saveProject(projectEngine.getFiles());
  }

  private handleStart(): void {
    const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
    const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      ?? (activeEditorPath ? path.dirname(activeEditorPath) : undefined);
    if (!projectRoot) {
      this.postMessage({ type: 'error', message: 'Ouvrez un dossier ou un fichier avant de démarrer.' });
      return;
    }
    const baseSession = this.persistence.readSessionConfig(projectRoot);
    this.workflow.configure({
      ...baseSession,
      overwriteStrategy: OverwriteStrategy.CLEAR_THEN_TYPE,
      typing: { ...this.typingConfig },
      error: { ...this.errorConfig },
    });
    void this.workflow.start();
  }

  private applyConfigUpdate(partial: Partial<TypingConfig & ErrorConfig>): void {
    const typing = { ...this.typingConfig };
    const error = { ...this.errorConfig };
    if (partial.mode === TypingMode.AUTO || partial.mode === TypingMode.MANUAL) { typing.mode = partial.mode; }
    if (isFiniteNumber(partial.speed)) { typing.speed = clamp(partial.speed, 0.5, 100); }
    if (isFiniteNumber(partial.randomness)) { typing.randomness = clamp(partial.randomness, 0, 100); }
    if (typeof partial.humanPauses === 'boolean') { typing.humanPauses = partial.humanPauses; }
    if (isFiniteNumber(partial.rate)) { error.rate = clamp(partial.rate, 0, 100); }
    if (typeof partial.correctionEnabled === 'boolean') { error.correctionEnabled = partial.correctionEnabled; }
    if (Object.values(CorrectionDelay).includes(partial.correctionDelay as CorrectionDelay)) {
      error.correctionDelay = partial.correctionDelay as CorrectionDelay;
    }
    this.typingConfig = typing;
    this.errorConfig = error;
  }

  private reloadSettings(): void {
    this.typingConfig = this.persistence.readTypingConfig();
    this.errorConfig = this.persistence.readErrorConfig();
    this.postConfig();
  }

  private postConfig(): void {
    this.postMessage({
      type: 'configLoaded',
      typing: this.typingConfig,
      error: this.errorConfig,
      simulationMode: this.workflow.getSimulationMode(),
    });
  }

  private postMessage(msg: ExtensionMessage): void {
    void this.view?.webview.postMessage(msg);
    void this.modalPanel?.webview.postMessage(msg);
  }

  private createScanner(): FileScanner {
    return new FileScanner(
      this.persistence.readExcludedDirectories(),
      this.persistence.readExcludedExtensions(),
      this.persistence.readMaxFileSize()
    );
  }
}

function describeAction(action: CodingAction): string {
  switch (action.type) {
    case 'openFile': return `Ouverture ${action.path}`;
    case 'moveCursor': return `Curseur (L${action.line + 1})`;
    case 'think': return `Analyse (${(action.durationMs / 1000).toFixed(1)}s): ${action.reasonCode ?? action.trigger}`;
    case 'typeText': return `Injection bloc (${action.text.length} car.)`;
    case 'runTerminal': return `Exécution: ${action.command}`;
    case 'revision': return `Révision: ${action.operation}`;
    default: return action.type;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
