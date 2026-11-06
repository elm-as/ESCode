export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  initialContent: string;
  isDirty: boolean;
  language: string;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
}
