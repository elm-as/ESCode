import { EngineState, ProgressInfo, WorkflowStep, WorkflowStepType } from '../types';
import { CodingAction } from '../intelligence/actions/action-types';

/** Where the session stands, independent of the simulation mode. */
export interface ProgressSnapshot {
  currentFile: string;
  /** 0-based index among the files of the session */
  fileIndex: number;
  totalFiles: number;
  /** Characters typed in the current unit (file or snippet) */
  charsInCurrent: number;
  /** Characters of the current unit */
  currentTotal: number;
  /** Characters of all units already completed */
  charsBefore: number;
  totalChars: number;
}

export interface SessionStatistics {
  elapsedMs: number;
  totalErrors: number;
  totalCorrections: number;
  state: EngineState;
}

/** Snapshot for replay mode. Command/wait steps don't count as files. */
export function snapshotReplay(
  steps: readonly WorkflowStep[],
  currentStepIndex: number,
  charIndex: number
): ProgressSnapshot {
  const fileSteps = steps.filter(s => s.type === WorkflowStepType.WRITE_FILE && s.file);
  const completedFileSteps = steps
    .slice(0, currentStepIndex)
    .filter(s => s.type === WorkflowStepType.WRITE_FILE && s.file);
  const currentFile = steps[currentStepIndex]?.file;

  return {
    currentFile: currentFile?.path ?? '',
    fileIndex: Math.min(completedFileSteps.length, Math.max(fileSteps.length - 1, 0)),
    totalFiles: fileSteps.length,
    charsInCurrent: currentFile ? Math.min(charIndex, currentFile.content.length) : 0,
    currentTotal: currentFile?.content.length ?? 0,
    charsBefore: sumLengths(completedFileSteps.map(s => s.file!.content)),
    totalChars: sumLengths(fileSteps.map(s => s.file!.content)),
  };
}

/** Snapshot for cognitive mode: progress is measured on typed snippets. */
export function snapshotCognitive(
  actions: readonly CodingAction[],
  currentActionIndex: number,
  charIndex: number
): ProgressSnapshot {
  const openedFiles = actions.flatMap(a => (a.type === 'openFile' ? [a.path] : []));
  const distinctFiles = Array.from(new Set(openedFiles));
  const openedSoFar = actions
    .slice(0, currentActionIndex + 1)
    .flatMap(a => (a.type === 'openFile' ? [a.path] : []));
  const currentFile = openedSoFar[openedSoFar.length - 1] ?? '';
  const current = actions[currentActionIndex];
  const currentText = current?.type === 'typeText' ? current.text : '';

  return {
    currentFile,
    fileIndex: Math.max(distinctFiles.indexOf(currentFile), 0),
    totalFiles: distinctFiles.length,
    charsInCurrent: Math.min(charIndex, currentText.length),
    currentTotal: currentText.length,
    charsBefore: sumLengths(typedTexts(actions.slice(0, currentActionIndex))),
    totalChars: sumLengths(typedTexts(actions)),
  };
}

/** Turn a snapshot and live statistics into the ProgressInfo shown by the UI. */
export function computeProgress(snapshot: ProgressSnapshot, stats: SessionStatistics): ProgressInfo {
  const written = snapshot.charsBefore + snapshot.charsInCurrent;
  const speed = stats.elapsedMs > 0 ? written / (stats.elapsedMs / 1000) : 0;
  const remaining = Math.max(snapshot.totalChars - written, 0);

  return {
    currentFile: snapshot.currentFile,
    currentFileIndex: snapshot.fileIndex,
    totalFiles: snapshot.totalFiles,
    charsWritten: snapshot.charsInCurrent,
    totalChars: snapshot.currentTotal,
    fileProgress: percentage(snapshot.charsInCurrent, snapshot.currentTotal),
    overallProgress: percentage(written, snapshot.totalChars),
    currentSpeed: Math.round(speed * 10) / 10,
    totalErrors: stats.totalErrors,
    totalCorrections: stats.totalCorrections,
    elapsedTime: stats.elapsedMs,
    estimatedRemainingTime: speed > 0 ? (remaining / speed) * 1000 : 0,
    state: stats.state,
  };
}

function typedTexts(actions: readonly CodingAction[]): string[] {
  return actions.flatMap(a => (a.type === 'typeText' ? [a.text] : []));
}

function sumLengths(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + text.length, 0);
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.min((part / total) * 100, 100) : 0;
}
