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
exports.ConfigPanel = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const FileScanner_1 = require("../parser/FileScanner");
const ProjectParser_1 = require("../parser/ProjectParser");
const file_classification_1 = require("../parser/file-classification");
const logger_1 = require("../infrastructure/logger");
const webview_html_1 = require("./webview-html");
/**
 * Camouflaged Webview controller ("Inspecteur AST & Flux Syntaxique").
 * Can be rendered either in a sidebar WebviewView or opened on-demand
 * via a stealth shortcut (Ctrl+Alt+K) as a standalone editor tab.
 */
class ConfigPanel {
    extensionUri;
    workflow;
    persistence;
    static viewType = 'fakecoder.mainView';
    view;
    modalPanel;
    logger = logger_1.Logger.getInstance();
    disposables = [];
    typingConfig;
    errorConfig;
    constructor(extensionUri, workflow, persistence) {
        this.extensionUri = extensionUri;
        this.workflow = workflow;
        this.persistence = persistence;
        this.typingConfig = persistence.readTypingConfig();
        this.errorConfig = persistence.readErrorConfig();
        this.workflow.addProgressListener(progress => this.postMessage({ type: 'progressUpdate', progress }));
        this.workflow.addStateListener(state => this.postMessage({ type: 'stateChange', state }));
        this.workflow.addActionListener((action, index, total) => this.postMessage({
            type: 'cognitiveAction', actionDescription: describeAction(action), index, total,
        }));
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('fakecoder')) {
                this.reloadSettings();
            }
        }));
    }
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        this.setupWebview(webviewView.webview);
    }
    /** Opens or reveals the camouflaged panel in an editor tab (Ctrl+Alt+K). */
    openOrToggleModalPanel() {
        if (this.modalPanel) {
            this.modalPanel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel('elmasAstInspector', 'Inspecteur AST & Flux', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.extensionUri] });
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
    async toggleQuickSession(forcedMode) {
        if (forcedMode) {
            this.typingConfig = { ...this.typingConfig, mode: forcedMode };
            this.postConfig();
        }
        const state = this.workflow.getState();
        if (state === types_1.EngineState.PAUSED) {
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
    dispose() {
        this.modalPanel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
    setupWebview(webview) {
        webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
        webview.html = (0, webview_html_1.buildWebviewHtml)(webview);
        webview.onDidReceiveMessage((msg) => this.handleMessage(msg), undefined, this.disposables);
    }
    async handleMessage(msg) {
        try {
            await this.routeMessage(msg);
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Erreur inattendue';
            this.logger.error('Message handling failed', err);
            this.postMessage({ type: 'error', message: errMsg });
        }
    }
    async routeMessage(msg) {
        switch (msg.type) {
            case 'ready': return this.handleReady();
            case 'captureActiveFile': return this.handleCaptureActiveFile();
            case 'captureWorkspace': return this.handleCaptureWorkspace();
            case 'importFile': return this.handleImportFiles(false);
            case 'importFiles': return this.handleImportFiles(true);
            case 'importFolder': return this.handleImportFolder();
            case 'pasteProject': return this.loadFiles(new ProjectParser_1.ProjectParser().parseProjectJson(msg.data));
            case 'pasteCode': return this.loadFiles(new ProjectParser_1.ProjectParser().parseRawCode(msg.data, msg.filename));
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
    handleReady() {
        this.postConfig();
        const files = this.workflow.getProjectEngine().getFiles();
        if (files.length > 0) {
            this.postMessage({ type: 'projectLoaded', files });
        }
        this.postMessage({ type: 'stateChange', state: this.workflow.getState() });
    }
    /** Captures the currently active editor file (or first visible editor) for instant replay. */
    async handleCaptureActiveFile() {
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
        const file = {
            ...(0, file_classification_1.createProjectFile)(relPath, content),
            overwriteStrategy: types_1.OverwriteStrategy.CLEAR_THEN_TYPE,
        };
        await this.loadFiles([file]);
    }
    /** Scans all eligible source files in the active workspace folder. */
    async handleCaptureWorkspace() {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
            throw new Error('Aucun dossier de projet ouvert dans l’espace de travail.');
        }
        const scanned = await this.createScanner().scanDirectory(root);
        const withClearStrategy = scanned.map(f => ({
            ...f,
            overwriteStrategy: types_1.OverwriteStrategy.CLEAR_THEN_TYPE,
        }));
        await this.loadFiles(withClearStrategy);
    }
    async handleImportFiles(multi) {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: multi,
            canSelectFiles: true,
            canSelectFolders: false,
            title: multi ? 'Sélectionner des fichiers sources' : 'Sélectionner un fichier source',
        });
        if (!uris || uris.length === 0) {
            return;
        }
        await this.loadFiles(await this.createScanner().processFiles(uris.map(u => u.fsPath)));
    }
    async handleImportFolder() {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            title: 'Sélectionner un dossier de projet à importer',
        });
        if (!uris || uris.length === 0) {
            return;
        }
        await this.loadFiles(await this.createScanner().scanDirectory(uris[0].fsPath));
    }
    async loadFiles(files) {
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
    async handleToggleFile(filePath, enabled) {
        const projectEngine = this.workflow.getProjectEngine();
        projectEngine.toggleFile(filePath, enabled);
        await this.persistence.saveProject(projectEngine.getFiles());
    }
    handleStart() {
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
            overwriteStrategy: types_1.OverwriteStrategy.CLEAR_THEN_TYPE,
            typing: { ...this.typingConfig },
            error: { ...this.errorConfig },
        });
        void this.workflow.start();
    }
    applyConfigUpdate(partial) {
        const typing = { ...this.typingConfig };
        const error = { ...this.errorConfig };
        if (partial.mode === types_1.TypingMode.AUTO || partial.mode === types_1.TypingMode.MANUAL) {
            typing.mode = partial.mode;
        }
        if (isFiniteNumber(partial.speed)) {
            typing.speed = clamp(partial.speed, 0.5, 100);
        }
        if (isFiniteNumber(partial.randomness)) {
            typing.randomness = clamp(partial.randomness, 0, 100);
        }
        if (typeof partial.humanPauses === 'boolean') {
            typing.humanPauses = partial.humanPauses;
        }
        if (isFiniteNumber(partial.rate)) {
            error.rate = clamp(partial.rate, 0, 100);
        }
        if (typeof partial.correctionEnabled === 'boolean') {
            error.correctionEnabled = partial.correctionEnabled;
        }
        if (Object.values(types_1.CorrectionDelay).includes(partial.correctionDelay)) {
            error.correctionDelay = partial.correctionDelay;
        }
        this.typingConfig = typing;
        this.errorConfig = error;
    }
    reloadSettings() {
        this.typingConfig = this.persistence.readTypingConfig();
        this.errorConfig = this.persistence.readErrorConfig();
        this.postConfig();
    }
    postConfig() {
        this.postMessage({
            type: 'configLoaded',
            typing: this.typingConfig,
            error: this.errorConfig,
            simulationMode: this.workflow.getSimulationMode(),
        });
    }
    postMessage(msg) {
        void this.view?.webview.postMessage(msg);
        void this.modalPanel?.webview.postMessage(msg);
    }
    createScanner() {
        return new FileScanner_1.FileScanner(this.persistence.readExcludedDirectories(), this.persistence.readExcludedExtensions(), this.persistence.readMaxFileSize());
    }
}
exports.ConfigPanel = ConfigPanel;
function describeAction(action) {
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
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=config-panel.js.map