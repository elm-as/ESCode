export interface ToolItem {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  required_for: string[];
}

export interface ToolchainStatus {
  tools: ToolItem[];
  android_sdk_path: string | null;
  flutter_sdk_path: string | null;
  java_home: string | null;
}
