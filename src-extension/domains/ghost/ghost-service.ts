import * as vscode from 'vscode';
import { WorkflowEngine } from './core/WorkflowEngine';
import { ConfigPanel } from './ui/config-panel';
import { ProgressPanel } from './ui/progress-panel';
import { Persistence } from './infrastructure/persistence';
import { Logger } from './infrastructure/logger';
import { TypingMode } from './types';

let activeWorkflow: WorkflowEngine | undefined;

/**
 * Registers the camouflaged AST Inspector / Ghost Coder domain inside Elmas Studio.
 * Exposes stealth shortcuts (Ctrl+Alt+M, Ctrl+Alt+K) and Terminal Chat triggers.
 */
export function registerGhostDomain(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  const persistence = new Persistence(context);
  const workflow = new WorkflowEngine();
  activeWorkflow = workflow;
  workflow.setPersistence(persistence);

  const savedProject = persistence.getProject();
  if (savedProject.length > 0) {
    workflow.getProjectEngine().loadFiles(savedProject);
  }

  const progressPanel = new ProgressPanel('elmasStudio.ghostToggle');
  progressPanel.show();
  workflow.addProgressListener(progress => {
    progressPanel.updateProgress(progress);
  });

  const configPanel = new ConfigPanel(context.extensionUri, workflow, persistence);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ConfigPanel.viewType, configPanel),
    configPanel,
    progressPanel,
    vscode.commands.registerCommand('elmasStudio.ghostConfig', () => {
      configPanel.openOrToggleModalPanel();
    }),
    vscode.commands.registerCommand('elmasStudio.ghostToggle', async () => {
      await configPanel.toggleQuickSession();
    }),
    vscode.commands.registerCommand('elmasStudio.ghostManual', async () => {
      await configPanel.toggleQuickSession(TypingMode.MANUAL);
    }),
    vscode.commands.registerCommand('elmasStudio.ghostAuto', async () => {
      await configPanel.toggleQuickSession(TypingMode.AUTO);
    }),
    vscode.commands.registerCommand('elmasStudio.ghostStop', () => {
      workflow.stop();
      progressPanel.setIdle();
    })
  );

  logger.info('Inspecteur AST domain registered');
}

export function disposeGhostDomain(): void {
  activeWorkflow?.dispose();
  Logger.getInstance().dispose();
}
