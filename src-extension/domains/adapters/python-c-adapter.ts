import * as http from "http";
import * as path from "path";
import * as vscode from "vscode";
import { ChildProcess } from "child_process";
import {
  AdapterCapabilities,
  AdapterRunResult,
  AdapterStartOptions,
  AdapterStatus,
  IFrameworkAdapter,
  SupportedFramework,
} from "./types";
import { renderPythonCPreviewHtml, ScriptEntry } from "./python-c-preview-html";
import {
  discoverWorkspaceScripts,
  spawnAnsiStream,
  spawnPygameStream,
} from "./python-c-runner";

export class PythonCVisualAdapter implements IFrameworkAdapter {
  readonly name = "Python (Pygame / CLI) & C (ANSI / 9:16)";
  readonly framework: SupportedFramework = "python_c_visual";

  private currentStatus: AdapterStatus = { state: "idle", mode: "fast" };
  private server: http.Server | null = null;
  private activeChild: ChildProcess | null = null;
  private sseClients: http.ServerResponse[] = [];
  private scripts: ScriptEntry[] = [];
  private activeScript: ScriptEntry | null = null;
  private latestJpegFrame: Buffer | null = null;
  private latestAnsiHtml: string = "Chargement…";
  private rootPath: string = "";

  async detectProject(projectPath: string): Promise<boolean> {
    const found = discoverWorkspaceScripts(projectPath);
    return found.length > 0;
  }

  async validateEnvironment(_mode: "fast" | "native"): Promise<{ valid: boolean; reason?: string }> {
    return { valid: true };
  }

  async initialize(): Promise<void> {
    this.currentStatus = { state: "idle", mode: "fast" };
  }

  async start(options: AdapterStartOptions): Promise<AdapterRunResult> {
    await this.stop();
    this.rootPath = options.projectPath;
    this.scripts = discoverWorkspaceScripts(options.projectPath);

    const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
    this.activeScript =
      this.findMatchingScript(activeEditorPath) ||
      this.scripts.find((s) => s.kind === "pygame") ||
      this.scripts[0] ||
      null;

    if (this.activeScript) {
      this.launchScriptProcess(this.activeScript);
    }

    return new Promise<AdapterRunResult>((resolve, reject) => {
      const srv = http.createServer((req, res) => this.handleHttp(req, res));
      srv.on("error", (err) => reject(err));
      srv.listen(options.port, "127.0.0.1", () => {
        this.server = srv;
        this.currentStatus = { state: "running", mode: options.mode, port: options.port };
        resolve({
          previewUrl: `http://localhost:${options.port}`,
          port: options.port,
          processId: `python_c_${options.port}`,
        });
      });
    });
  }

  async stop(): Promise<void> {
    this.killActiveChild();
    for (const c of this.sseClients) {
      try {
        c.end();
      } catch {}
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
    if (this.activeScript) {
      this.launchScriptProcess(this.activeScript);
    }
  }

  async onDocumentEdited(filePath: string, _content: string): Promise<void> {
    const matched = this.findMatchingScript(filePath);
    if (!matched) {
      return;
    }
    if (!this.activeScript || matched.fullPath !== this.activeScript.fullPath) {
      this.activeScript = matched;
      this.launchScriptProcess(matched);
      this.broadcastEvent({ type: "switch", relPath: matched.relPath });
    }
  }

  getStatus(): AdapterStatus {
    return this.currentStatus;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsFastPreview: true,
      supportsNativePreview: false,
      supportsHmr: true,
      supportsHotRestart: true,
      supportsElementInspection: false,
      targetPlatform: "python-c-9x16",
    };
  }

  private findMatchingScript(filePath?: string): ScriptEntry | undefined {
    if (!filePath) return undefined;
    const norm = path.resolve(filePath).toLowerCase();
    const direct = this.scripts.find((s) => path.resolve(s.fullPath).toLowerCase() === norm);
    if (direct) return direct;

    const dirNorm = path.dirname(norm);
    return this.scripts.find(
      (s) => path.dirname(path.resolve(s.fullPath).toLowerCase()) === dirNorm
    );
  }

  private killActiveChild(): void {
    if (this.activeChild) {
      try {
        this.activeChild.kill();
      } catch {}
      this.activeChild = null;
    }
  }

  private launchScriptProcess(entry: ScriptEntry): void {
    this.killActiveChild();
    this.latestJpegFrame = null;
    this.latestAnsiHtml = `Exécution de ${entry.relPath}…`;

    if (entry.kind === "pygame") {
      this.activeChild = spawnPygameStream(
        entry.fullPath,
        (jpeg) => {
          this.latestJpegFrame = jpeg;
        },
        (errText) => {
          this.broadcastEvent({ type: "status", text: errText.slice(0, 60) });
        }
      );
    } else {
      this.activeChild = spawnAnsiStream(entry, (html) => {
        this.latestAnsiHtml = html;
        this.broadcastEvent({ type: "ansi", html });
      });
    }
  }

  private broadcastEvent(payload: Record<string, unknown>): void {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const c of this.sseClients) {
      try {
        c.write(msg);
      } catch {}
    }
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsed = new URL(req.url || "/", "http://127.0.0.1");

    if (parsed.pathname === "/__elmas_events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      if (this.activeScript && this.activeScript.kind !== "pygame") {
        res.write(`data: ${JSON.stringify({ type: "ansi", html: this.latestAnsiHtml })}\n\n`);
      }
      this.sseClients.push(res);
      req.on("close", () => {
        this.sseClients = this.sseClients.filter((c) => c !== res);
      });
      return;
    }

    if (parsed.pathname === "/__elmas_frame.jpg") {
      if (!this.latestJpegFrame) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "Content-Length": this.latestJpegFrame.length,
      });
      res.end(this.latestJpegFrame);
      return;
    }

    if (parsed.pathname === "/__elmas_select" && req.method === "POST") {
      const rel = parsed.searchParams.get("script");
      const found = this.scripts.find((s) => s.relPath === rel);
      if (found) {
        this.activeScript = found;
        this.launchScriptProcess(found);
      }
      res.writeHead(200);
      res.end("ok");
      return;
    }

    if (parsed.pathname === "/__elmas_key" && req.method === "POST") {
      const k = parsed.searchParams.get("key") || "SPACE";
      try {
        this.activeChild?.stdin?.write(`KEY:${k}\n`);
      } catch {}
      res.writeHead(200);
      res.end("ok");
      return;
    }

    if (parsed.pathname === "/__elmas_restart" && req.method === "POST") {
      if (this.activeScript) {
        this.launchScriptProcess(this.activeScript);
      }
      res.writeHead(200);
      res.end("ok");
      return;
    }

    const activeRel = this.activeScript?.relPath || "";
    const activeKind = this.activeScript?.kind || "pygame";
    const html = renderPythonCPreviewHtml(this.scripts, activeRel, activeKind);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  }
}
