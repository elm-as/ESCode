import { CodePosition } from '../knowledge/fact-types';

/**
 * Categorized triggers for realistic cognitive thinking pauses.
 */
export type ThinkTrigger =
  | 'before-edit'
  | 'after-diagnostic'
  | 'before-navigation'
  | 'planning'
  | 'uncertainty'
  | 'verification';

export interface OpenFileAction {
  type: 'openFile';
  path: string;
}

export interface MoveCursorAction {
  type: 'moveCursor';
  line: number;
  character: number;
  selectLength?: number;
}

export interface ThinkAction {
  type: 'think';
  durationMs: number;
  trigger: ThinkTrigger;
  reasonCode?: string;
}

export interface TypeAction {
  type: 'typeText';
  text: string;
  speedMultiplier?: number;
}

export interface BackspaceAction {
  type: 'backspace';
  count: number;
}

export interface RevisionAction {
  type: 'revision';
  operation: 'deleteRange' | 'replaceRange' | 'undo' | 'insertAt';
  start: CodePosition;
  end?: CodePosition;
  replacementText?: string;
  reason?: string;
}

export interface RunTerminalAction {
  type: 'runTerminal';
  command: string;
  waitForCompletion?: boolean;
}

export interface InspectDiagnosticAction {
  type: 'inspectDiagnostic';
  severity: 'error' | 'warning';
  location?: CodePosition;
  message?: string;
}

/**
 * Union of all discrete human developer actions on the timeline.
 */
export type CodingAction =
  | OpenFileAction
  | MoveCursorAction
  | ThinkAction
  | TypeAction
  | BackspaceAction
  | RevisionAction
  | RunTerminalAction
  | InspectDiagnosticAction;
