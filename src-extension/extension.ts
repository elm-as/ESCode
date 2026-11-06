import * as vscode from "vscode";
import { DevicePreviewViewProvider } from "./domains/preview/DevicePreviewViewProvider";
import { adapterManager } from "./domains/adapters/adapter-manager";
import { sdkDetector } from "./domains/sdk/sdk-detector";

let previewProvider: DevicePreviewViewProvider;
let runStatusBarItem: vscode.StatusBarItem;
let modeStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  previewProvider = new DevicePreviewViewProvider();

  // 1. Register Webview View in Activity Bar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DevicePreviewViewProvider.viewType,
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
        description: t.version || (t.installed ? "Ready" : "Missing"),
        detail: t.path || `Required for: ${t.requiredFor.join(", ")}`,
      }));
      vscode.window.showQuickPick(items, {
        placeHolder: "Elmas Studio — Installed Toolchain & SDK Status",
      });
    })
  );

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
    adapterManager.detectWorkspaceFramework(folders[0].uri.fsPath).then((fw) => {
      if (fw !== "unknown") {
        vscode.window.showInformationMessage(
          `Elmas Studio: Detected ${fw.toUpperCase()} project. Ready for mobile preview.`
        );
      }
    });
  }
}

function updateStatusBar(isRunning: boolean): void {
  if (isRunning) {
    runStatusBarItem.command = "elmasStudio.stopProject";
    runStatusBarItem.text = "$(primitive-square) Stop Preview";
    runStatusBarItem.tooltip = "Stop mobile development server";
  } else {
    runStatusBarItem.command = "elmasStudio.runProject";
    runStatusBarItem.text = "$(play) Run Preview";
    runStatusBarItem.tooltip = "Start mobile development preview";
  }
}

export function deactivate(): void {
  adapterManager.stopProject();
}

