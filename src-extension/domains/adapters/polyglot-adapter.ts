import * as http from "http";
import * as path from "path";
import { ChildProcess } from "child_process";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
  SupportedFramework,
} from "./types";
import {
  detectPolyglotTarget,
  ResolvedPolyglotTarget,
} from "./polyglot-manifest";
import { renderPolyglotPreviewHtml } from "./polyglot-preview-html";
import { processManager } from "../process/process-manager";

export class PolyglotUniversalAdapter implements IFrameworkAdapter {
  readonly name = "Polyglot Universal Runner (Rust/Go/Zig/Custom)";
  readonly framework: SupportedFramework = "polyglot_custom";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private server: http.Server | null = null;
  private activeTarget: ResolvedPolyglotTarget | null = null;
  private activeChild: ChildProcess | null = null;
  private sseClients: http.ServerResponse[] = [];
  private accumulatedAnsi: string = "";
  private reloadDebounceTimer: NodeJS.Timeout | null = null;

  async detectProject(projectPath: string): Promise<boolean> {
    const target = detectPolyglotTarget(projectPath);
    return target !== null;
  }

  async validateEnvironment(_mode: "fast" | "native"): Promise<{ valid: boolean }> {
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    await this.stop();
    const target = detectPolyglotTarget(options.projectPath);
    if (!target) {
      throw new Error(`Aucune configuration polyglotte trouvée pour ${options.projectPath}`);
    }
    this.activeTarget = target;
    this.launchProcess(options.projectPath, target);

    return new Promise<AdapterRunResult>((resolve, reject) => {
      const srv = http.createServer((req, res) => this.handleHttp(req, res));
      srv.on("error", (err) => reject(err));
      srv.listen(options.port, "127.0.0.1", () => {
        this.server = srv;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        resolve({
          previewUrl: `http://localhost:${options.port}`,
          port: options.port,
          processId: `polyglot_${options.port}`,
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (this.activeChild) {
      try { this.activeChild.kill(); } catch {}
      this.activeChild = null;
    }
    for (const c of this.sseClients) {
      try { c.end(); } catch {}
    }
    this.sseClients = [];
    if (this.server) {
      await new Promise<void>((r) => {
        this.server?.close(() => r());
        this.server = null;
      });
    }
    this.currentStatus = { state: "stopped", mode: "fast" };
  }

  async reload(): Promise<void> {
    if (this.activeTarget) {
      const root = path.resolve(".");
      this.launchProcess(root, this.activeTarget);
    }
  }

  async onDocumentEdited(filePath: string, _content: string): Promise<void> {
    if (!this.activeTarget) return;
    const ext = path.extname(filePath).toLowerCase();
    const matches = this.activeTarget.watchPatterns.some(
      (pat) => pat === "**/*" || ext === pat || pat.endsWith(ext)
    );
    if (!matches) return;

    if (this.reloadDebounceTimer) clearTimeout(this.reloadDebounceTimer);
    this.reloadDebounceTimer = setTimeout(() => {
      this.reload();
    }, 280);
  }

  getStatus(): AdapterStatus {
    return this.currentStatus;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsFastPreview: true,
      supportsNativePreview: false,
      supportsHmr: false,
      supportsHotRestart: true,
      supportsElementInspection: false,
      targetPlatform: "polyglot-desktop",
    };
  }

  private launchProcess(projectPath: string, target: ResolvedPolyglotTarget): void {
    if (this.activeChild) {
      try { this.activeChild.kill(); } catch {}
      this.activeChild = null;
    }
    this.accumulatedAnsi = `[${target.name}] Démarrage de: ${target.command}\n`;

    const child = processManager.startProcess({
      id: "polyglot_exec",
      command: target.command,
      args: [],
      cwd: projectPath,
      onStdout: (line) => {
        this.accumulatedAnsi = (this.accumulatedAnsi + line + "\n").slice(-8000);
        this.broadcastEvent({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) });
      },
      onStderr: (line) => {
        this.accumulatedAnsi = (this.accumulatedAnsi + line + "\n").slice(-8000);
        this.broadcastEvent({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) });
      },
      onExit: (code) => {
        const status = code === 0 ? "Terminé (0)" : `Sortie code ${code}`;
        this.broadcastEvent({ type: "status", text: status });
      },
    });

    this.activeChild = child;
  }

  private broadcastEvent(payload: Record<string, unknown>): void {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const c of this.sseClients) {
      try { c.write(msg); } catch {}
    }
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsed = new URL(req.url || "/", "http://127.0.0.1");

    if (parsed.pathname === "/__elmas_polyglot_events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ type: "ansi", html: escapeHtml(this.accumulatedAnsi) })}\n\n`);
      this.sseClients.push(res);
      req.on("close", () => {
        this.sseClients = this.sseClients.filter((c) => c !== res);
      });
      return;
    }

    if (parsed.pathname === "/__elmas_polyglot_key" && req.method === "POST") {
      const k = parsed.searchParams.get("key") || "SPACE";
      try {
        this.activeChild?.stdin?.write(`${k === "SPACE" ? " " : k}\n`);
      } catch {}
      res.writeHead(200);
      res.end("ok");
      return;
    }

    if (parsed.pathname === "/__elmas_polyglot_restart" && req.method === "POST") {
      void this.reload();
      res.writeHead(200);
      res.end("ok");
      return;
    }

    if (!this.activeTarget) {
      res.writeHead(404);
      res.end("No active polyglot target");
      return;
    }

    const previewUrl = this.activeTarget.port ? `http://localhost:${this.activeTarget.port}` : "";
    const html = renderPolyglotPreviewHtml(this.activeTarget, previewUrl);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  }
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
