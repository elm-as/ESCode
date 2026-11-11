import * as vscode from "vscode";
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

  private selectedProfile: DeviceProfile = STANDARD_PROFILES[0];
  private orientation: DeviceOrientation = "portrait";
  private mode: PreviewMode = "fast";
  private status: "idle" | "starting" | "running" | "error" = "idle";
  private previewUrl: string | null = null;
  private errorMessage?: string;
  private zoom: number = 0.85;

  hasActivePanel(): boolean {
    return Boolean(this.currentView);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.onDidDispose(() => {
      this.currentView = undefined;
    });
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.updateWebview(webviewView.webview);

    if (this.status === "idle" && vscode.workspace.workspaceFolders?.length) {
      void this.runCurrentProject();
    }
  }

  /**
   * Si un ancien onglet d'éditeur persisté d'une session précédente tente de se rouvrir,
   * on le ferme immédiatement : le simulateur vit exclusivement dans le panneau latéral droit.
   */
  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    _state: unknown
  ): Promise<void> {
    webviewPanel.dispose();
    await this.openAsPanel(vscode.Uri.file(""));
  }

  /**
   * Affiche le simulateur uniquement dans le panneau latéral secondaire droit (Secondary Side Bar).
   */
  async openAsPanel(_extensionUri: vscode.Uri): Promise<void> {
    try {
      await vscode.commands.executeCommand("elmasStudio.devicePreview.focus");
    } catch {
      // Ignorer si la vue est en cours d'initialisation
    }
    if (this.status === "idle" && vscode.workspace.workspaceFolders?.length) {
      await this.runCurrentProject();
    }
  }

  private handleMessage(msg: { type: string; value?: unknown }): void {
    switch (msg.type) {
      case "setMode":
        this.setMode(msg.value as PreviewMode);
        break;
      case "setProfile":
        this.setProfile(String(msg.value ?? ""));
        break;
      case "setCustomUrl":
        this.setCustomUrl(String(msg.value ?? ""));
        break;
      case "toggleOrientation":
        this.toggleOrientation();
        break;
      case "runProject":
        void this.runCurrentProject();
        break;
      case "stopProject":
        void this.stopCurrentProject();
        break;
      case "reload":
        adapterManager.reloadProject();
        this.reloadFrameOnly();
        break;
      case "openLogs":
        void vscode.commands.executeCommand("elmasStudio.terminalChat.focus");
        break;
      case "openSdkManager":
        void vscode.commands.executeCommand("elmasStudio.openSdkManager");
        break;
      case "screenshot":
        vscode.window.showInformationMessage("Elmas Studio : Capture d'écran mobile enregistrée.");
        break;
    }
  }

  reloadFrameOnly(): void {
    if (this.currentView) {
      void this.currentView.webview.postMessage({ type: "reloadFrame" });
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

  setCustomUrl(rawUrl: string): void {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return;
    let formatted = trimmed;
    if (/^\d+$/.test(trimmed)) {
      formatted = `http://localhost:${trimmed}`;
    } else if (trimmed.startsWith(":")) {
      formatted = `http://localhost${trimmed}`;
    } else if (!/^https?:\/\//i.test(trimmed)) {
      formatted = `http://${trimmed}`;
    }
    this.previewUrl = formatted;
    this.status = "running";
    this.refreshWebviews();
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

    if (!this.currentView) {
      try {
        await vscode.commands.executeCommand("elmasStudio.devicePreview.focus");
      } catch {
        // Ignorer
      }
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    this.status = "starting";
    this.refreshWebviews();

    try {
      const framework = await adapterManager.detectWorkspaceFramework(rootPath);
      if (framework === "python_c_visual" || framework === "polyglot_custom") {
        const fluid = STANDARD_PROFILES.find((p) => p.id === "fluid");
        if (fluid && this.selectedProfile.id === "iphone-15-pro") {
          this.selectedProfile = fluid;
        }
      } else if (framework === "flutter" || framework === "react_native") {
        const phone = STANDARD_PROFILES.find((p) => p.id === "iphone-15-pro");
        if (phone && this.selectedProfile.id === "fluid") {
          this.selectedProfile = phone;
        }
      }

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
