import * as vscode from 'vscode';
import { EngineState, SessionState, WorkflowStep } from '../types';
import { Persistence } from '../infrastructure/persistence';

/**
 * Offers to resume an interrupted replay session of the same project.
 * Resumption restarts the interrupted file from scratch: its buffer only
 * holds a partial draft that may still contain uncorrected typos.
 * @returns the workflow step index to start from (0 = beginning)
 */
export async function chooseResumeStep(
  persistence: Persistence | undefined,
  steps: readonly WorkflowStep[],
  projectSignature: string
): Promise<number> {
  const session = persistence?.getSession();
  if (!session || session.projectSignature !== projectSignature) { return 0; }

  const stepIndex = steps.findIndex(s => s.file?.path === session.currentFilePath);
  if (stepIndex <= 0) { return 0; }

  const choice = await vscode.window.showInformationMessage(
    `FakeCoder: resume the interrupted session at "${session.currentFilePath}" `
    + `(file ${session.fileIndex + 1})?`,
    'Resume', 'Start over'
  );
  return choice === 'Resume' ? stepIndex : 0;
}

/** Everything saved about the file currently being typed. */
export interface SessionCheckpoint {
  projectSignature: string;
  currentFilePath: string;
  fileIndex: number;
  workflowStepIndex: number;
  state: EngineState;
  totalErrors: number;
  totalCorrections: number;
  elapsedTime: number;
}

export function buildSessionState(checkpoint: SessionCheckpoint): SessionState {
  return {
    ...checkpoint,
    charIndex: 0,
    pendingErrors: [],
    savedAt: Date.now(),
  };
}
