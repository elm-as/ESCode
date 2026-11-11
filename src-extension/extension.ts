import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { DevicePreviewViewProvider } from "./domains/preview/DevicePreviewViewProvider";
import { TerminalChatViewProvider } from "./domains/terminal-chat/TerminalChatViewProvider";
import { adapterManager } from "./domains/adapters/adapter-manager";
import { sdkDetector } from "./domains/sdk/sdk-detector";
import { registerGhostDomain, disposeGhostDomain } from "./domains/ghost/ghost-service";

let previewProvider: DevicePreviewViewProvider;
let terminalChatProvider: TerminalChatViewProvider;
let missionControlStatusBarItem: vscode.StatusBarItem;
let runStatusBarItem: vscode.StatusBarItem;
let modeStatusBarItem: vscode.StatusBarItem;
let chatStatusBarItem: vscode.StatusBarItem;
let liveEditTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function launchStandaloneMissionControl(extensionPath: string): void {
  const candidates = [
    path.join(extensionPath, "bin", "elmas-mission-control.exe"),
    path.resolve(extensionPath, "..", "..", "..", "..", "target", "debug", "tauri-app.exe"),
    path.resolve(extensionPath, "..", "..", "..", "..", "target", "release", "tauri-app.exe"),
    "C:\\Users\\elmas\\Desktop\\Projets\\ESCode\\target\\debug\\tauri-app.exe",
    "C:\\Users\\elmas\\Desktop\\Projets\\ESCode\\target\\release\\tauri-app.exe",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const child = spawn(candidate, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      child.unref();
      return;
    }
  }

  vscode.window.showWarningMessage(
    "Application autonome Elmas Mission Control introuvable. Lancez `pnpm run start:dashboard`."
  );
}

export function activate(context: vscode.ExtensionContext): void {
  previewProvider = new DevicePreviewViewProvider();
  terminalChatProvider = new TerminalChatViewProvider();

  // 1. Register Webview View & Panel Serializer (restores panel on reload)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DevicePreviewViewProvider.viewType,
      previewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerWebviewViewProvider(
      TerminalChatViewProvider.viewType,
      terminalChatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerWebviewPanelSerializer(
      "elmasStudio.devicePreviewPanel",
      previewProvider
    )
  );

  // 2. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("elmasStudio.openMissionControl", async () => {
      launchStandaloneMissionControl(context.extensionPath);
    }),
    vscode.commands.registerCommand("elmasStudio.openPreview", async () => {
      await previewProvider.openAsPanel(context.extensionUri);
    }),
    vscode.commands.registerCommand("elmasStudio.runProject", async () => {
      await previewProvider.runCurrentProject();
      updateStatusBar(true);
    }),
    vscode.commands.registerCommand("elmasStudio.stopProject", async () => {
      await previewProvider.stopCurrentProject();
      updateStatusBar(false);
    }),
    vscode.commands.registerCommand("elmasStudio.openSdkManager", async () => {
      const toolchain = await sdkDetector.scanToolchain();
      const items = toolchain.tools.map((t) => ({
        label: `${t.installed ? "$(check)" : "$(x)"} ${t.name}`,
        description: t.version || (t.installed ? "Installé" : "Manquant"),
        detail: t.path || `Requis pour : ${t.requiredFor.join(", ")}`,
      }));
      vscode.window.showQuickPick(items, {
        placeHolder: "Elmas Studio — État des SDK & Outils de développement",
      });
    })
  );

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
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      if (doc.uri.scheme !== "file" || event.contentChanges.length === 0) {
        return;
      }

      const filePath = doc.uri.fsPath;
      const content = doc.getText();

      if (liveEditTimer) clearTimeout(liveEditTimer);
      liveEditTimer = setTimeout(() => {
        adapterManager.notifyDocumentEdited(filePath, content);
      }, 20);

      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(async () => {
        if (doc.isDirty && !doc.isUntitled) {
          try {
            await doc.save();
          } catch {
            // Ignore save conflicts while typing
          }
        }
      }, 180);
    })
  );

  // 5. Switch active preview screen when user clicks a screen file in Explorer
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || editor.document.uri.scheme !== "file") {
        return;
      }
      adapterManager.notifyDocumentEdited(
        editor.document.uri.fsPath,
        editor.document.getText()
      );
    })
  );

  // 6. Auto-reload preview on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.scheme !== "file") return;
      await adapterManager.notifyDocumentEdited(doc.uri.fsPath, doc.getText());
      await adapterManager.reloadProject();
    })
  );

  // 7. Register stealth AST Inspector / Ghost Coder domain
  registerGhostDomain(context);

  // 8. Cleanly stop any running simulation when closing or changing workspace
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await adapterManager.stopProject();
      updateStatusBar(false);
    })
  );

  // 8. Activer le Terminal Chat en bas et afficher le Simulateur dans le panneau latéral droit
  setTimeout(async () => {
    try {
      const wbConfig = vscode.workspace.getConfiguration("workbench");
      if (wbConfig.get<string>("iconTheme") !== "elmas-macos-sequoia-icons") {
        await wbConfig.update("iconTheme", "elmas-macos-sequoia-icons", vscode.ConfigurationTarget.Global);
      }
      await vscode.commands.executeCommand("elmasStudio.terminalChat.focus");
      await vscode.commands.executeCommand("elmasStudio.devicePreview.focus");
    } catch {
      // Ignorer si la vue n'est pas encore prête
    }
  }, 400);
}

function updateStatusBar(isRunning: boolean): void {
  if (isRunning) {
    runStatusBarItem.command = "elmasStudio.stopProject";
    runStatusBarItem.text = "$(primitive-square) Arrêter l'Aperçu";
    runStatusBarItem.tooltip = "Arrêter le serveur d'aperçu mobile";
  } else {
    runStatusBarItem.command = "elmasStudio.runProject";
    runStatusBarItem.text = "$(play) Lancer l'Aperçu";
    runStatusBarItem.tooltip = "Démarrer le serveur d'aperçu mobile en temps réel";
  }
}

export function deactivate(): void {
  disposeGhostDomain();
  adapterManager.stopProject();
}
