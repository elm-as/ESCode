export type SupportedFramework =
  | "vanilla_web"
  | "react_web"
  | "react_native"
  | "flutter"
  | "kotlin_compose"
  | "unknown";

export interface AdapterCapabilities {
  supportsFastPreview: boolean;
  supportsNativePreview: boolean;
  supportsHmr: boolean;
  supportsHotRestart: boolean;
  supportsElementInspection: boolean;
  targetPlatform: string;
}

export interface AdapterStartOptions {
  projectPath: string;
  mode: "fast" | "native";
  port: number;
}

export interface AdapterRunResult {
  previewUrl: string;
  port: number;
  processId: string;
}

export interface AdapterStatus {
  state: "idle" | "starting" | "running" | "error" | "stopped";
  mode: "fast" | "native";
  port?: number;
  error?: string;
}

export interface IFrameworkAdapter {
  readonly name: string;
  readonly framework: SupportedFramework;

  detectProject(projectPath: string): Promise<boolean>;
  validateEnvironment(mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }>;
  initialize(): Promise<void>;
  start(options: AdapterStartOptions): Promise<AdapterRunResult>;
  stop(): Promise<void>;
  reload(): Promise<void>;
  getStatus(): AdapterStatus;
  getCapabilities(): AdapterCapabilities;
}

