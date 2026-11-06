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
const DevicePreviewViewProvider_1 = require("./domains/preview/DevicePreviewViewProvider");
const adapter_manager_1 = require("./domains/adapters/adapter-manager");
const sdk_detector_1 = require("./domains/sdk/sdk-detector");
let previewProvider;
let runStatusBarItem;
let modeStatusBarItem;
function activate(context) {
    previewProvider = new DevicePreviewViewProvider_1.DevicePreviewViewProvider();
    // 1. Register Webview View in Activity Bar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(DevicePreviewViewProvider_1.DevicePreviewViewProvider.viewType, previewProvider));
    // 2. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand("elmasStudio.openPreview", async () => {
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
            description: t.version || (t.installed ? "Ready" : "Missing"),
            detail: t.path || `Required for: ${t.requiredFor.join(", ")}`,
        }));
        vscode.window.showQuickPick(items, {
            placeHolder: "Elmas Studio — Installed Toolchain & SDK Status",
        });
    }));
    // 3. Register Status Bar Items
    runStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    runStatusBarItem.command = "elmasStudio.runProject";
    runStatusBarItem.text = "$(play) Run Preview";
    runStatusBarItem.tooltip = "Start mobile development preview";
    runStatusBarItem.show();
    context.subscriptions.push(runStatusBarItem);
    modeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    modeStatusBarItem.command = "elmasStudio.openPreview";
    modeStatusBarItem.text = "$(device-mobile) Mobile Preview";
    modeStatusBarItem.tooltip = "Open Elmas Studio Mobile Virtual Device";
    modeStatusBarItem.show();
    context.subscriptions.push(modeStatusBarItem);
    // Auto-detect project on folder open
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        adapter_manager_1.adapterManager.detectWorkspaceFramework(folders[0].uri.fsPath).then((fw) => {
            if (fw !== "unknown") {
                const label = fw === "vanilla_web" ? "HTML / CSS / JS" : fw.toUpperCase();
                vscode.window.showInformationMessage(`Elmas Studio: Detected ${label} project. Ready for mobile preview.`);
            }
        });
    }
    // Auto-reload preview on file save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async () => {
        await adapter_manager_1.adapterManager.reloadProject();
    }));
}
function updateStatusBar(isRunning) {
    if (isRunning) {
        runStatusBarItem.command = "elmasStudio.stopProject";
        runStatusBarItem.text = "$(primitive-square) Stop Preview";
        runStatusBarItem.tooltip = "Stop mobile development server";
    }
    else {
        runStatusBarItem.command = "elmasStudio.runProject";
        runStatusBarItem.text = "$(play) Run Preview";
        runStatusBarItem.tooltip = "Start mobile development preview";
    }
}
function deactivate() {
    adapter_manager_1.adapterManager.stopProject();
}
//# sourceMappingURL=extension.js.map