export type DeviceOrientation = "portrait" | "landscape";

export type PreviewMode = "fast" | "native";

export interface DeviceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  is_default: boolean;
}

export interface PreviewBridgeMessage {
  type: "console" | "error" | "navigate" | "ready";
  level?: "info" | "warn" | "error" | "log";
  message?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
}

