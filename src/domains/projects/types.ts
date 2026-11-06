export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  children?: FileNode[];
}

export type SupportedFramework =
  | "react_web"
  | "react_native"
  | "flutter"
  | "kotlin_compose"
  | "unknown";

export interface ProjectDetectionResult {
  framework: SupportedFramework;
  entry_file: string | null;
  package_name: string | null;
  dev_script: string | null;
}

export interface RecentProject {
  id?: number;
  path: string;
  name: string;
  framework: string;
  last_opened: number;
}

