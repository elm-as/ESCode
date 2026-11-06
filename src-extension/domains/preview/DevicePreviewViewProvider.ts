import * as vscode from "vscode";
import {
  DeviceOrientation,
  DeviceProfile,
  PreviewMode,
  STANDARD_PROFILES,
} from "./device-profiles";
import { generateDeviceHtml } from "./get-device-html";
import { adapterManager } from "../adapters/adapter-manager";

export class DevicePreviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "elmasStudio.devicePreview";

  private currentView?: vscode.WebviewView;
  private currentPanel?: vscode.WebviewPanel;

  private selectedProfile: DeviceProfile = STANDARD_PROFILES[2]; // Flagship 390x844
  private orientation: DeviceOrientation = "portrait";
  private mode: PreviewMode = "fast";
  private status: "idle" | "starting" | "running" | "error" = "idle";
  private previewUrl: string | null = null;
  private errorMessage?: string;
  private zoom: number = 0.85;

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

  openAsPanel(extensionUri: vscode.Uri): void {
    if (this.currentPanel) {
      this.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.currentPanel = vscode.window.createWebviewPanel(
      "elmasStudio.devicePreviewPanel",
      "Mobile Live Preview",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
    });

    this.currentPanel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.updateWebview(this.currentPanel.webview);
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
        this.refreshWebviews();
        break;
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
      vscode.window.showErrorMessage("Please open a project folder in VSCodium first.");
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
      vscode.window.showInformationMessage(`Elmas Studio: Mobile preview running on ${result.previewUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status = "error";
      this.errorMessage = msg;
      this.refreshWebviews();
      vscode.window.showErrorMessage(`Elmas Studio: ${msg}`);
    }
  }

  async stopCurrentProject(): Promise<void> {
    await adapterManager.stopProject();
    this.status = "idle";
    this.previewUrl = null;
    this.refreshWebviews();
    vscode.window.showInformationMessage("Elmas Studio: Mobile preview server stopped.");
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

