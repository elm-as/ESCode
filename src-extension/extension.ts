import * as vscode from "vscode";
import { DevicePreviewViewProvider } from "./domains/preview/DevicePreviewViewProvider";
import { adapterManager } from "./domains/adapters/adapter-manager";
import { sdkDetector } from "./domains/sdk/sdk-detector";

let previewProvider: DevicePreviewViewProvider;
let runStatusBarItem: vscode.StatusBarItem;
let modeStatusBarItem: vscode.StatusBarItem;
let liveEditTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function activate(context: vscode.ExtensionContext): void {
  previewProvider = new DevicePreviewViewProvider();

  // 1. Register Webview View & Panel Serializer (restores panel on reload)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DevicePreviewViewProvider.viewType,
      previewProvider
    ),
    vscode.window.registerWebviewPanelSerializer(
      "elmasStudio.devicePreviewPanel",
      previewProvider
    )
  );

  // 2. Register Commands
  context.subscriptions.push(
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

  // 5. Auto-reload preview on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.scheme !== "file") return;
      await adapterManager.notifyDocumentEdited(doc.uri.fsPath, doc.getText());
      await adapterManager.reloadProject();
    })
  );
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
  adapterManager.stopProject();
}
