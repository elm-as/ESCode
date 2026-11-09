import * as vscode from 'vscode';
import { ProgressInfo, EngineState } from '../types';

/**
 * Displays real-time typing progress in the status bar under a discreet
 * AST / Language Server telemetry label so it blends into the IDE.
 */
export class ProgressPanel implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;

  constructor(toggleCommandId = 'fakecoder.toggleQuick') {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      95
    );
    this.statusBarItem.name = 'Inspecteur AST';
    this.statusBarItem.command = toggleCommandId;
    this.setIdle();
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  setIdle(): void {
    this.statusBarItem.text = '$(pulse) AST · Prêt';
    this.statusBarItem.tooltip = 'Inspecteur AST & Flux Syntaxique (Ctrl+Alt+M : Démarrer/Pause · Ctrl+Alt+K : Configurer)';
    this.statusBarItem.show();
  }

  updateProgress(progress: ProgressInfo): void {
    if (progress.state === EngineState.IDLE || progress.state === EngineState.COMPLETED || progress.state === EngineState.CANCELLED) {
      this.setIdle();
      return;
    }

    const stateIcon = this.mapStateToIcon(progress.state);
    const pct = progress.overallProgress.toFixed(0);
    const speed = progress.currentSpeed.toFixed(1);

    this.statusBarItem.text = `${stateIcon} AST · ${pct}% (${speed} c/s)`;
    this.statusBarItem.tooltip = this.buildTooltip(progress);
    this.statusBarItem.show();
  }

  private buildTooltip(progress: ProgressInfo): string {
    const elapsed = this.formatDuration(progress.elapsedTime);
    const remaining = this.formatDuration(progress.estimatedRemainingTime);

    return [
      `Cible : ${progress.currentFile}`,
      `Progression fichier : ${progress.fileProgress.toFixed(1)}%`,
      `Jetons : ${progress.charsWritten.toLocaleString()} / ${progress.totalChars.toLocaleString()}`,
      `Global : ${progress.overallProgress.toFixed(1)}%`,
      `Débit : ${progress.currentSpeed.toFixed(1)} c/s`,
      `Écarts / Corrections : ${progress.totalErrors} / ${progress.totalCorrections}`,
      `Écoulé : ${elapsed} · Restant : ${remaining}`,
    ].join('\n');
  }

  private mapStateToIcon(state: EngineState): string {
    const icons: Record<EngineState, string> = {
      [EngineState.IDLE]: '$(pulse)',
      [EngineState.PREPARING]: '$(loading~spin)',
      [EngineState.TYPING]: '$(sync~spin)',
      [EngineState.PAUSED]: '$(debug-pause)',
      [EngineState.CORRECTING]: '$(sparkle)',
      [EngineState.EXECUTING]: '$(terminal)',
      [EngineState.WAITING_TERMINAL]: '$(loading~spin)',
      [EngineState.COMPLETED]: '$(check)',
      [EngineState.CANCELLED]: '$(circle-slash)',
      [EngineState.ERROR]: '$(warning)',
    };
    return icons[state] ?? '$(pulse)';
  }

  private formatDuration(ms: number): string {
    if (ms <= 0) { return '—'; }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
