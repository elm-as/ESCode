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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const DevicePreviewViewProvider_1 = require("./domains/preview/DevicePreviewViewProvider");
const TerminalChatViewProvider_1 = require("./domains/terminal-chat/TerminalChatViewProvider");
const adapter_manager_1 = require("./domains/adapters/adapter-manager");
const sdk_detector_1 = require("./domains/sdk/sdk-detector");
const ghost_service_1 = require("./domains/ghost/ghost-service");
let previewProvider;
let terminalChatProvider;
let missionControlStatusBarItem;
let runStatusBarItem;
let modeStatusBarItem;
let chatStatusBarItem;
let liveEditTimer = null;
let autoSaveTimer = null;
function launchStandaloneMissionControl(extensionPath) {
    const candidates = [
        path.join(extensionPath, "bin", "elmas-mission-control.exe"),
        path.resolve(extensionPath, "..", "..", "..", "..", "target", "debug", "tauri-app.exe"),
        path.resolve(extensionPath, "..", "..", "..", "..", "target", "release", "tauri-app.exe"),
        "C:\\Users\\elmas\\Desktop\\Projets\\ESCode\\target\\debug\\tauri-app.exe",
        "C:\\Users\\elmas\\Desktop\\Projets\\ESCode\\target\\release\\tauri-app.exe",
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            const child = (0, child_process_1.spawn)(candidate, [], {
                detached: true,
                stdio: "ignore",
                windowsHide: false,
            });
            child.unref();
            return;
        }
    }
    vscode.window.showWarningMessage("Application autonome Elmas Mission Control introuvable. Lancez `pnpm run start:dashboard`.");
}
function activate(context) {
    previewProvider = new DevicePreviewViewProvider_1.DevicePreviewViewProvider();
    terminalChatProvider = new TerminalChatViewProvider_1.TerminalChatViewProvider();
    // 1. Register Webview View & Panel Serializer (restores panel on reload)
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(DevicePreviewViewProvider_1.DevicePreviewViewProvider.viewType, previewProvider, { webviewOptions: { retainContextWhenHidden: true } }), vscode.window.registerWebviewViewProvider(TerminalChatViewProvider_1.TerminalChatViewProvider.viewType, terminalChatProvider, { webviewOptions: { retainContextWhenHidden: true } }), vscode.window.registerWebviewPanelSerializer("elmasStudio.devicePreviewPanel", previewProvider));
    // 2. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand("elmasStudio.openMissionControl", async () => {
        launchStandaloneMissionControl(context.extensionPath);
    }), vscode.commands.registerCommand("elmasStudio.openPreview", async () => {
        await previewProvider.openAsPanel(context.extensionUri);
    }), vscode.commands.registerCommand("elmasStudio.runProject", async () => {
        await previewProvider.runCurrentProject();
        updateStatusBar(true);
    }), vscode.commands.registerCommand("elmasStudio.stopProject", async () => {
        await previewProvider.stopCurrentProject();
        updateStatusBar(false);
    }), vscode.commands.registerCommand("elmasStudio.openSdkManager", async () => {
        const toolchain = await sdk_detector_1.sdkDetector.scanToolchain();
        const items = toolchain.tools.map((t) => ({
            label: `${t.installed ? "$(check)" : "$(x)"} ${t.name}`,
            description: t.version || (t.installed ? "Installé" : "Manquant"),
            detail: t.path || `Requis pour : ${t.requiredFor.join(", ")}`,
        }));
        vscode.window.showQuickPick(items, {
            placeHolder: "Elmas Studio — État des SDK & Outils de développement",
        });
    }));
    // 3. Register Status Bar Items (French)
    missionControlStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 105);
    missionControlStatusBarItem.command = "elmasStudio.openMissionControl";
    missionControlStatusBarItem.text = "$(dashboard) Mission Control";
    missionControlStatusBarItem.tooltip = "Ouvrir le Tableau de Bord Elmas Mission Control (Ctrl+Shift+M)";
    missionControlStatusBarItem.show();
    context.subscriptions.push(missionControlStatusBarItem);
    runStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    runStatusBarItem.command = "elmasStudio.runProject";
    runStatusBarItem.text = "$(play) Lancer l'Aperçu";
    runStatusBarItem.tooltip = "Démarrer le serveur d'aperçu mobile en temps réel";
    runStatusBarItem.show();
    context.subscriptions.push(runStatusBarItem);
    modeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    modeStatusBarItem.command = "elmasStudio.openPreview";
    modeStatusBarItem.text = "$(device-mobile) Aperçu Mobile";
    modeStatusBarItem.tooltip = "Ouvrir l'appareil mobile virtuel Elmas Studio";
    modeStatusBarItem.show();
    context.subscriptions.push(modeStatusBarItem);
    chatStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    chatStatusBarItem.command = "elmasStudio.terminalChat.focus";
    chatStatusBarItem.text = "$(comment-discussion) Terminal Chat";
    chatStatusBarItem.tooltip = "Ouvrir le terminal sous forme de discussion interactive";
    chatStatusBarItem.show();
    context.subscriptions.push(chatStatusBarItem);
    // 4. Ultra-reactive keystroke listener (zero-save instant live preview)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (doc.uri.scheme !== "file" || event.contentChanges.length === 0) {
            return;
        }
        const filePath = doc.uri.fsPath;
        const content = doc.getText();
        if (liveEditTimer)
            clearTimeout(liveEditTimer);
        liveEditTimer = setTimeout(() => {
            adapter_manager_1.adapterManager.notifyDocumentEdited(filePath, content);
        }, 20);
        if (autoSaveTimer)
            clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            if (doc.isDirty && !doc.isUntitled) {
                try {
                    await doc.save();
                }
                catch {
                    // Ignore save conflicts while typing
                }
            }
        }, 180);
    }));
    // 5. Switch active preview screen when user clicks a screen file in Explorer
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || editor.document.uri.scheme !== "file") {
            return;
        }
        adapter_manager_1.adapterManager.notifyDocumentEdited(editor.document.uri.fsPath, editor.document.getText());
    }));
    // 6. Auto-reload preview on file save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (doc.uri.scheme !== "file")
            return;
        await adapter_manager_1.adapterManager.notifyDocumentEdited(doc.uri.fsPath, doc.getText());
        await adapter_manager_1.adapterManager.reloadProject();
    }));
    // 7. Register stealth AST Inspector / Ghost Coder domain
    (0, ghost_service_1.registerGhostDomain)(context);
    // 8. Cleanly stop any running simulation when closing or changing workspace
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await adapter_manager_1.adapterManager.stopProject();
        updateStatusBar(false);
    }));
    // 8. Activate Conversational Terminal Chat in bottom panel & select Simulator in Right Sidebar
    setTimeout(async () => {
        try {
            const wbConfig = vscode.workspace.getConfiguration("workbench");
            if (wbConfig.get("iconTheme") !== "elmas-macos-sequoia-icons") {
                await wbConfig.update("iconTheme", "elmas-macos-sequoia-icons", vscode.ConfigurationTarget.Global);
            }
            await vscode.commands.executeCommand("elmasStudio.terminalChat.focus");
            await vscode.commands.executeCommand("workbench.view.extension.elmas-studio-right-simulator");
        }
        catch {
            // Ignore if view not ready yet
        }
    }, 300);
}
function updateStatusBar(isRunning) {
    if (isRunning) {
        runStatusBarItem.command = "elmasStudio.stopProject";
        runStatusBarItem.text = "$(primitive-square) Arrêter l'Aperçu";
        runStatusBarItem.tooltip = "Arrêter le serveur d'aperçu mobile";
    }
    else {
        runStatusBarItem.command = "elmasStudio.runProject";
        runStatusBarItem.text = "$(play) Lancer l'Aperçu";
        runStatusBarItem.tooltip = "Démarrer le serveur d'aperçu mobile en temps réel";
    }
}
function deactivate() {
    (0, ghost_service_1.disposeGhostDomain)();
    adapter_manager_1.adapterManager.stopProject();
}
//# sourceMappingURL=extension.js.map