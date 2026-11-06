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
exports.DevicePreviewViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const device_profiles_1 = require("./device-profiles");
const get_device_html_1 = require("./get-device-html");
const adapter_manager_1 = require("../adapters/adapter-manager");
class DevicePreviewViewProvider {
    static viewType = "elmasStudio.devicePreview";
    currentView;
    currentPanel;
    selectedProfile = device_profiles_1.STANDARD_PROFILES[2]; // Flagship 390x844
    orientation = "portrait";
    mode = "fast";
    status = "idle";
    previewUrl = null;
    errorMessage;
    zoom = 0.85;
    resolveWebviewView(webviewView, _context, _token) {
        this.currentView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
        this.updateWebview(webviewView.webview);
    }
    async openAsPanel(extensionUri) {
        if (this.currentPanel) {
            this.currentPanel.reveal(vscode.ViewColumn.Two);
            return;
        }
        await this.ensureCodeEditorInLeftColumn();
        this.currentPanel = vscode.window.createWebviewPanel("elmasStudio.devicePreviewPanel", "Mobile Live Preview", vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
        this.currentPanel.onDidDispose(() => {
            this.currentPanel = undefined;
        });
        this.currentPanel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
        this.updateWebview(this.currentPanel.webview);
    }
    async ensureCodeEditorInLeftColumn() {
        const openEditors = vscode.window.visibleTextEditors;
        if (openEditors.some((ed) => ed.viewColumn === vscode.ViewColumn.One)) {
            return;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return;
        }
        const rootPath = folders[0].uri.fsPath;
        const candidates = [
            "src/App.tsx",
            "src/App.jsx",
            "src/main.tsx",
            "src/main.jsx",
            "lib/main.dart",
            "src/main/kotlin/Main.kt",
            "index.html",
            "package.json",
        ];
        for (const relPath of candidates) {
            const fullPath = path.join(rootPath, relPath);
            if (fs.existsSync(fullPath)) {
                try {
                    const doc = await vscode.workspace.openTextDocument(fullPath);
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.One,
                        preview: false,
                    });
                    return;
                }
                catch {
                    // Continue scanning next candidate
                }
            }
        }
    }
    handleMessage(msg) {
        switch (msg.type) {
            case "setMode":
                this.setMode(msg.value);
                break;
            case "setProfile":
                this.setProfile(msg.value);
                break;
            case "toggleOrientation":
                this.toggleOrientation();
                break;
            case "runProject":
                this.runCurrentProject();
                break;
            case "stopProject":
                this.stopCurrentProject();
                break;
            case "reload":
                this.refreshWebviews();
                break;
        }
    }
    setMode(mode) {
        this.mode = mode;
        this.refreshWebviews();
    }
    setProfile(profileId) {
        const found = device_profiles_1.STANDARD_PROFILES.find((p) => p.id === profileId);
        if (found) {
            this.selectedProfile = found;
            this.refreshWebviews();
        }
    }
    toggleOrientation() {
        this.orientation = this.orientation === "portrait" ? "landscape" : "portrait";
        this.refreshWebviews();
    }
    async runCurrentProject() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("Please open a project folder in Elmas Studio first.");
            return;
        }
        if (!this.currentPanel && !this.currentView) {
            await this.openAsPanel(vscode.Uri.file(""));
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        this.status = "starting";
        this.refreshWebviews();
        try {
            const result = await adapter_manager_1.adapterManager.startProject(rootPath, this.mode);
            this.previewUrl = result.previewUrl;
            this.status = "running";
            this.refreshWebviews();
            vscode.window.showInformationMessage(`Elmas Studio: Preview running on ${result.previewUrl}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.status = "error";
            this.errorMessage = msg;
            this.refreshWebviews();
            vscode.window.showErrorMessage(`Elmas Studio: ${msg}`);
        }
    }
    async stopCurrentProject() {
        await adapter_manager_1.adapterManager.stopProject();
        this.status = "idle";
        this.previewUrl = null;
        this.refreshWebviews();
        vscode.window.showInformationMessage("Elmas Studio: Mobile preview server stopped.");
    }
    refreshWebviews() {
        if (this.currentView) {
            this.updateWebview(this.currentView.webview);
        }
        if (this.currentPanel) {
            this.updateWebview(this.currentPanel.webview);
        }
    }
    updateWebview(webview) {
        webview.html = (0, get_device_html_1.generateDeviceHtml)({
            profile: this.selectedProfile,
            orientation: this.orientation,
            mode: this.mode,
            previewUrl: this.previewUrl,
            status: this.status,
            errorMessage: this.errorMessage,
            zoom: this.zoom,
        });
    }
}
exports.DevicePreviewViewProvider = DevicePreviewViewProvider;
//# sourceMappingURL=DevicePreviewViewProvider.js.map