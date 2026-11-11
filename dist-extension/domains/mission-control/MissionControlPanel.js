"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionControlPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
class MissionControlPanel {
    extensionUri;
    static viewType = "elmasStudio.missionControlView";
    static panelType = "elmasStudio.missionControlPanel";
    panel = null;
    sidebarView = null;
    cliProcess = null;
    activeWebviews = new Set();
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        this.sidebarView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri, vscode.Uri.file(this.resolveWorkspaceRoot())],
        };
        webviewView.webview.html = this.getSidebarHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg?.type === "openCockpit") {
                await this.openAsPanel();
            }
            else {
                await this.handleWebviewMessage(webviewView.webview, msg);
            }
        });
    }
    async openAsPanel() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const distDir = this.resolveDashboardDistDir();
        this.panel = vscode.window.createWebviewPanel(MissionControlPanel.panelType, "Elmas Mission Control", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                this.extensionUri,
                vscode.Uri.file(distDir),
                vscode.Uri.file(this.resolveWorkspaceRoot()),
            ],
        });
        const webview = this.panel.webview;
        this.activeWebviews.add(webview);
        webview.html = this.getDashboardHtml(webview, distDir);
        webview.onDidReceiveMessage(async (msg) => {
            await this.handleWebviewMessage(webview, msg);
        });
        this.panel.onDidDispose(() => {
            this.activeWebviews.delete(webview);
            this.panel = null;
        });
    }
    ensureCliDaemon() {
        if (this.cliProcess && !this.cliProcess.killed) {
            return this.cliProcess;
        }
        const binPath = this.resolveCliBinaryPath();
        if (!binPath) {
            vscode.window.showErrorMessage("Binaire `elmas-mc.exe` introuvable pour Mission Control.");
            return null;
        }
        const child = (0, child_process_1.spawn)(binPath, ["serve"], {
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
        });
        const rl = readline.createInterface({ input: child.stdout });
        rl.on("line", (line) => {
            if (!line.trim())
                return;
            try {
                const parsed = JSON.parse(line);
                for (const wv of this.activeWebviews) {
                    wv.postMessage(parsed);
                }
            }
            catch {
                // Ignore malformed stdout lines
            }
        });
        child.on("exit", () => {
            this.cliProcess = null;
        });
        this.cliProcess = child;
        return child;
    }
    async handleWebviewMessage(webview, msg) {
        if (!msg || typeof msg.type !== "string")
            return;
        if (msg.type === "mc.rpc") {
            const daemon = this.ensureCliDaemon();
            if (!daemon) {
                webview.postMessage({
                    id: msg.id,
                    ok: false,
                    error: { code: "DAEMON_MISSING", message: "Serveur elmas-mc indisponible" },
                });
                return;
            }
            const line = JSON.stringify({
                id: msg.id,
                command: msg.command,
                payload: msg.payload ?? null,
            });
            daemon.stdin.write(`${line}\n`);
            return;
        }
        if (msg.type === "mc.host") {
            await this.executeHostAction(String(msg.action || ""), msg.payload || {});
        }
    }
    async executeHostAction(action, payload) {
        if (action === "openProject" && typeof payload.path === "string") {
            const uri = vscode.Uri.file(payload.path);
            await vscode.commands.executeCommand("vscode.openFolder", uri, false);
            return;
        }
        if (action === "openTerminal" && typeof payload.path === "string") {
            const term = vscode.window.createTerminal({
                name: `Elmas • ${path.basename(payload.path)}`,
                cwd: payload.path,
            });
            term.show();
            return;
        }
        if (action === "runCommandInTerminal" &&
            typeof payload.path === "string" &&
            typeof payload.command === "string") {
            const term = vscode.window.createTerminal({
                name: `Script • ${path.basename(payload.path)}`,
                cwd: payload.path,
            });
            term.show();
            term.sendText(payload.command);
            return;
        }
        if (action === "runPreview" && typeof payload.path === "string") {
            await vscode.commands.executeCommand("elmasStudio.runProject");
            return;
        }
        if (action === "openExternalUrl" && typeof payload.url === "string") {
            await vscode.env.openExternal(vscode.Uri.parse(payload.url));
            return;
        }
        if (action === "openInSimulator") {
            await vscode.commands.executeCommand("elmasStudio.openPreview");
        }
    }
    resolveWorkspaceRoot() {
        return path.resolve(this.extensionUri.fsPath, "..");
    }
    resolveDashboardDistDir() {
        const candidates = [
            path.join(this.extensionUri.fsPath, "dist-dashboard"),
            path.resolve(this.extensionUri.fsPath, "..", "dist-dashboard"),
            path.resolve(this.extensionUri.fsPath, "..", "..", "..", "..", "dist-dashboard"),
        ];
        for (const c of candidates) {
            if (fs.existsSync(path.join(c, "assets", "dashboard.js"))) {
                return c;
            }
        }
        return candidates[0];
    }
    resolveCliBinaryPath() {
        const exeName = process.platform === "win32" ? "elmas-mc.exe" : "elmas-mc";
        const candidates = [
            path.join(this.extensionUri.fsPath, "bin", exeName),
            path.resolve(this.extensionUri.fsPath, "..", "target", "release", exeName),
            path.resolve(this.extensionUri.fsPath, "..", "target", "debug", exeName),
            path.resolve(this.extensionUri.fsPath, "..", "..", "..", "..", "target", "release", exeName),
            path.resolve(this.extensionUri.fsPath, "..", "..", "..", "..", "target", "debug", exeName),
        ];
        return candidates.find((p) => fs.existsSync(p)) ?? null;
    }
    getDashboardHtml(webview, distDir) {
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(distDir, "assets", "dashboard.js")));
        const assetsDir = path.join(distDir, "assets");
        let cssLink = "";
        if (fs.existsSync(assetsDir)) {
            const cssFile = fs.readdirSync(assetsDir).find((f) => f.endsWith(".css"));
            if (cssFile) {
                const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile)));
                cssLink = `<link rel="stylesheet" href="${cssUri}" />`;
            }
        }
        return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${cssLink}
    <title>Elmas Mission Control</title>
  </head>
  <body style="margin:0;padding:0;background:#0c0c10;color:#f4f4f5;overflow:hidden;">
    <div id="root" style="height:100vh;width:100vw;"></div>
    <script type="module" src="${jsUri}"></script>
  </body>
</html>`;
    }
    getSidebarHtml() {
        return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:12px;background:#0c0c10;color:#e4e4e7;font-family:sans-serif;font-size:12px;">
    <div style="font-weight:700;color:#fbbf24;letter-spacing:0.06em;margin-bottom:6px;">
      ELMAS MISSION CONTROL
    </div>
    <p style="color:#a1a1aa;line-height:1.4;margin:0 0 12px 0;">
      Centre de commandement unifié : 61+ projets, radar des ports TCP, flotte Git, santé disque et coffre .env.
    </p>
    <button
      onclick="acquireVsCodeApi().postMessage({ type: 'openCockpit' })"
      style="width:100%;padding:8px 10px;background:#f59e0b;color:#09090b;font-weight:700;border:none;border-radius:4px;cursor:pointer;"
    >
      Ouvrir le Cockpit Complet (Ctrl+Shift+M)
    </button>
  </body>
</html>`;
    }
    dispose() {
        if (this.cliProcess && !this.cliProcess.killed) {
            this.cliProcess.kill();
            this.cliProcess = null;
        }
    }
}
exports.MissionControlPanel = MissionControlPanel;
//# sourceMappingURL=MissionControlPanel.js.map