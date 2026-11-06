export type DiagnosticSeverity = "error" | "warning" | "info";

export interface DiagnosticItem {
  id: string;
  framework: string;
  filePath?: string;
  line?: number;
  column?: number;
  severity: DiagnosticSeverity;
  category?: string;
  message: string;
  stack?: string;
  timestamp: number;
}
