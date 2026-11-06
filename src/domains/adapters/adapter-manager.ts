import { invoke } from "@tauri-apps/api/core";
import { IFrameworkAdapter } from "./types";
import { SupportedFramework } from "../projects/types";
import { ReactWebAdapter } from "./react-web-adapter";
import { ReactNativeAdapter } from "./react-native-adapter";
import { FlutterAdapter } from "./flutter-adapter";
import { KotlinComposeAdapter } from "./kotlin-adapter";
import { useDeviceStore } from "../preview/device-store";
import { useDiagnosticsStore } from "../diagnostics/diagnostics-store";

export class AdapterManager {
  private adapters: Map<SupportedFramework, IFrameworkAdapter> = new Map();
  private currentRunningAdapter: IFrameworkAdapter | null = null;

  constructor() {
    this.registerAdapter(new ReactWebAdapter());
    this.registerAdapter(new ReactNativeAdapter());
    this.registerAdapter(new FlutterAdapter());
    this.registerAdapter(new KotlinComposeAdapter());
  }

  private registerAdapter(adapter: IFrameworkAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  getAdapter(framework: SupportedFramework): IFrameworkAdapter | undefined {
    return this.adapters.get(framework);
  }

  async startProject(framework: SupportedFramework, projectPath: string): Promise<void> {
    const adapter = this.getAdapter(framework);
    if (!adapter) {
      throw new Error(`No adapter registered for framework: ${framework}`);
    }

    const { previewMode, setRuntimeStatus, setPreviewUrl } = useDeviceStore.getState();
    const { addDiagnostic } = useDiagnosticsStore.getState();

    // 1. Validate environment
    const validation = await adapter.validateEnvironment(previewMode);
    if (!validation.valid) {
      const msg = validation.reason || "Environment validation failed";
      setRuntimeStatus("error", msg);
      addDiagnostic({
        framework: adapter.name,
        severity: "error",
        message: msg,
      });
      throw new Error(msg);
    }

    // 2. Stop any currently running adapter
    if (this.currentRunningAdapter) {
      await this.currentRunningAdapter.stop();
      this.currentRunningAdapter = null;
    }

    // 3. Allocate free port dynamically
    setRuntimeStatus("starting");
    const port = await invoke<number>("process_allocate_port");

    try {
      const result = await adapter.start({
        projectPath,
        mode: previewMode,
        port,
      });

      this.currentRunningAdapter = adapter;
      setPreviewUrl(result.previewUrl);
      setRuntimeStatus("running");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setRuntimeStatus("error", errMsg);
      addDiagnostic({
        framework: adapter.name,
        severity: "error",
        message: errMsg,
      });
      throw err;
    }
  }

  async stopCurrentProject(): Promise<void> {
    if (this.currentRunningAdapter) {
      await this.currentRunningAdapter.stop();
      this.currentRunningAdapter = null;
    }
    const { setRuntimeStatus, setPreviewUrl } = useDeviceStore.getState();
    setRuntimeStatus("idle");
    setPreviewUrl(null);
  }
}

export const adapterManager = new AdapterManager();
