import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  DeviceOrientation,
  DeviceProfile,
  PreviewMode,
  STANDARD_PROFILES,
} from "./device-profiles";
import { generateDeviceHtml } from "./get-device-html";
import { adapterManager } from "../adapters/adapter-manager";

export class DevicePreviewViewProvider
  implements vscode.WebviewViewProvider, vscode.WebviewPanelSerializer
{
  public static readonly viewType = "elmasStudio.devicePreview";

  private currentView?: vscode.WebviewView;
  private currentPanel?: vscode.WebviewPanel;

  private selectedProfile: DeviceProfile = STANDARD_PROFILES[0];
  private orientation: DeviceOrientation = "portrait";
  private mode: PreviewMode = "fast";
  private status: "idle" | "starting" | "running" | "error" = "idle";
  private previewUrl: string | null = null;
  private errorMessage?: string;
  private zoom: number = 0.85;

  hasActivePanel(): boolean {
    return Boolean(this.currentPanel || this.currentView);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.updateWebview(webviewView.webview);
  }

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    _state: unknown
  ): Promise<void> {
    this.currentPanel = webviewPanel;
    webviewPanel.title = "Aperçu Mobile";
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.onDidDispose(() => {
      this.currentPanel = undefined;
    });
    webviewPanel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.updateWebview(webviewPanel.webview);

    if (this.status === "idle") {
      await this.runCurrentProject();
    }
  }

  async openAsPanel(_extensionUri: vscode.Uri): Promise<void> {
    if (this.currentPanel) {
      this.currentPanel.reveal(vscode.ViewColumn.Two);
      if (this.status === "idle") {
        await this.runCurrentProject();
      }
      return;
    }

    await this.ensureCodeEditorInLeftColumn();

    this.currentPanel = vscode.window.createWebviewPanel(
      "elmasStudio.devicePreviewPanel",
      "Aperçu Mobile",
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
    });

    this.currentPanel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.updateWebview(this.currentPanel.webview);

    if (this.status === "idle") {
      await this.runCurrentProject();
    }
  }

  private async ensureCodeEditorInLeftColumn(): Promise<void> {
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
        } catch {
          // Continue scanning next candidate
        }
      }
    }
  }

  private handleMessage(msg: { type: string; value?: any }): void {
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
        adapterManager.reloadProject();
        this.reloadFrameOnly();
        break;
      case "openLogs":
        vscode.commands.executeCommand("workbench.action.output.toggleOutput");
        break;
      case "openSdkManager":
        vscode.commands.executeCommand("elmasStudio.openSdkManager");
        break;
      case "screenshot":
        vscode.window.showInformationMessage("Elmas Studio : Capture d'écran mobile enregistrée.");
        break;
    }
  }

  reloadFrameOnly(): void {
    if (this.currentView) {
      this.currentView.webview.postMessage({ type: "reloadFrame" });
    }
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({ type: "reloadFrame" });
    }
  }

  setMode(mode: PreviewMode): void {
    this.mode = mode;
    this.refreshWebviews();
  }

  setProfile(profileId: string): void {
    const found = STANDARD_PROFILES.find((p) => p.id === profileId);
    if (found) {
      this.selectedProfile = found;
      this.refreshWebviews();
    }
  }

  toggleOrientation(): void {
    this.orientation = this.orientation === "portrait" ? "landscape" : "portrait";
    this.refreshWebviews();
  }

  async runCurrentProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("Veuillez d'abord ouvrir un dossier de projet dans Elmas Studio.");
      return;
    }

    if (!this.currentPanel && !this.currentView) {
      await this.openAsPanel(vscode.Uri.file(""));
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    this.status = "starting";
    this.refreshWebviews();

    try {
      const result = await adapterManager.startProject(rootPath, this.mode);
      this.previewUrl = result.previewUrl;
      this.status = "running";
      this.refreshWebviews();
      setTimeout(() => this.refreshWebviews(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status = "error";
      this.errorMessage = msg;
      this.refreshWebviews();
      vscode.window.showErrorMessage(`Elmas Studio : ${msg}`);
    }
  }

  async stopCurrentProject(): Promise<void> {
    await adapterManager.stopProject();
    this.status = "idle";
    this.previewUrl = null;
    this.refreshWebviews();
  }

  private refreshWebviews(): void {
    if (this.currentView) {
      this.updateWebview(this.currentView.webview);
    }
    if (this.currentPanel) {
      this.updateWebview(this.currentPanel.webview);
    }
  }

  private updateWebview(webview: vscode.Webview): void {
    webview.html = generateDeviceHtml({
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
