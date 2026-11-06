export interface ToolItem {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  requiredFor: string[];
}

export interface ToolchainStatus {
  tools: ToolItem[];
  androidSdkPath: string | null;
  flutterSdkPath: string | null;
  javaHome: string | null;
}

