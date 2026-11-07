import {
  AdapterRunResult,
  IFrameworkAdapter,
  SupportedFramework,
} from "./types";
import { ReactWebAdapter } from "./react-web-adapter";
import { ReactNativeAdapter } from "./react-native-adapter";
import { FlutterAdapter } from "./flutter-adapter";
import { KotlinComposeAdapter } from "./kotlin-adapter";
import { VanillaWebAdapter } from "./vanilla-web-adapter";
import { processManager } from "../process/process-manager";

export class ExtensionAdapterManager {
  private adapters: Map<SupportedFramework, IFrameworkAdapter> = new Map();
  private currentRunningAdapter: IFrameworkAdapter | null = null;
  private currentRunResult: AdapterRunResult | null = null;

  constructor() {
    this.registerAdapter(new ReactWebAdapter());
    this.registerAdapter(new ReactNativeAdapter());
    this.registerAdapter(new FlutterAdapter());
    this.registerAdapter(new KotlinComposeAdapter());
    this.registerAdapter(new VanillaWebAdapter());
  }

  private registerAdapter(adapter: IFrameworkAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  getAdapter(framework: SupportedFramework): IFrameworkAdapter | undefined {
    return this.adapters.get(framework);
  }

  async detectWorkspaceFramework(workspacePath: string): Promise<SupportedFramework> {
    for (const [framework, adapter] of this.adapters.entries()) {
      if (await adapter.detectProject(workspacePath)) {
        return framework;
      }
    }
    return "unknown";
  }

  async startProject(
    workspacePath: string,
    mode: "fast" | "native"
  ): Promise<AdapterRunResult> {
    const framework = await this.detectWorkspaceFramework(workspacePath);
    if (framework === "unknown") {
      throw new Error("Aucun framework mobile ou projet HTML détecté dans l'espace de travail.");
    }

    const adapter = this.getAdapter(framework);
    if (!adapter) {
      throw new Error(`Aucun adaptateur trouvé pour ${framework}`);
    }

    const validation = await adapter.validateEnvironment(mode);
    if (!validation.valid) {
      throw new Error(validation.reason || "Validation de l'environnement échouée.");
    }

    if (this.currentRunningAdapter) {
      await this.currentRunningAdapter.stop();
      this.currentRunningAdapter = null;
    }

    const port = await processManager.allocateFreePort();
    const result = await adapter.start({
      projectPath: workspacePath,
      mode,
      port,
    });

    this.currentRunningAdapter = adapter;
    this.currentRunResult = result;
    return result;
  }

  async stopProject(): Promise<void> {
    if (this.currentRunningAdapter) {
      await this.currentRunningAdapter.stop();
      this.currentRunningAdapter = null;
      this.currentRunResult = null;
    }
  }

  async reloadProject(): Promise<void> {
    if (this.currentRunningAdapter) {
      await this.currentRunningAdapter.reload();
    }
  }

  async notifyDocumentEdited(filePath: string, content: string): Promise<void> {
    if (this.currentRunningAdapter && this.currentRunningAdapter.onDocumentEdited) {
      await this.currentRunningAdapter.onDocumentEdited(filePath, content);
    }
  }

  getCurrentRunResult(): AdapterRunResult | null {
    return this.currentRunResult;
  }

  getCurrentAdapter(): IFrameworkAdapter | null {
    return this.currentRunningAdapter;
  }
}

export const adapterManager = new ExtensionAdapterManager();
