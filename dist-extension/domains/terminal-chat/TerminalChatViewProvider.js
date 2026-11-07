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
exports.TerminalChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const terminal_chat_html_1 = require("./terminal-chat-html");
const terminal_chat_runner_1 = require("./terminal-chat-runner");
class TerminalChatViewProvider {
    static viewType = "elmasStudio.terminalChat";
    currentView;
    messages = [];
    activeCwd = "";
    constructor() {
        this.activeCwd = this.resolveInitialCwd();
        this.seedWelcomeMessage();
    }
    resolveInitialCwd() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri.fsPath;
        }
        return process.cwd();
    }
    formatClockNow() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    seedWelcomeMessage() {
        this.messages = [
            {
                id: "welcome-1",
                role: "assistant",
                text: "Bonjour ! Que souhaites-tu faire ?",
                timestamp: this.formatClockNow(),
            },
        ];
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.currentView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.activeCwd = this.resolveInitialCwd();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "sendChatCommand" && typeof msg.text === "string") {
                await this.handleUserMessage(msg.text);
            }
            else if (msg.type === "clearChat") {
                this.seedWelcomeMessage();
                this.syncWebview();
            }
        });
        const projectName = path.basename(this.activeCwd || "Projet");
        webviewView.webview.html = (0, terminal_chat_html_1.renderTerminalChatHtml)(projectName, this.messages);
    }
    async handleUserMessage(rawText) {
        if (!this.activeCwd) {
            this.activeCwd = this.resolveInitialCwd();
        }
        const userMsg = {
            id: `u-${Date.now()}`,
            role: "user",
            text: rawText,
            timestamp: this.formatClockNow(),
        };
        this.messages.push(userMsg);
        const translation = (0, terminal_chat_runner_1.interpretUserChatInput)(rawText, this.activeCwd);
        const replyId = `a-${Date.now()}`;
        const replyMsg = {
            id: replyId,
            role: "assistant",
            text: translation.conversationalIntro,
            status: translation.shellCommand ? "running" : "success",
            timestamp: this.formatClockNow(),
        };
        this.messages.push(replyMsg);
        this.syncWebview();
        if (translation.ideCommand) {
            await vscode.commands.executeCommand(translation.ideCommand);
            replyMsg.status = "success";
            this.syncWebview();
            return;
        }
        if (!translation.shellCommand) {
            return;
        }
        const result = await (0, terminal_chat_runner_1.executeChatShellCommand)(translation.shellCommand, this.activeCwd, (cleanedText, isServerReady) => {
            replyMsg.codeOutput = cleanedText;
            if (isServerReady) {
                replyMsg.status = "success";
            }
            this.syncWebview();
        });
        this.activeCwd = result.newCwd;
        replyMsg.codeOutput = result.output;
        replyMsg.durationMs = result.durationMs;
        replyMsg.status = result.exitCode === 0 ? "success" : "error";
        this.syncWebview();
    }
    syncWebview() {
        if (!this.currentView)
            return;
        this.currentView.webview.postMessage({
            type: "syncMessages",
            messages: this.messages,
            projectName: path.basename(this.activeCwd || "Projet"),
        });
    }
}
exports.TerminalChatViewProvider = TerminalChatViewProvider;
//# sourceMappingURL=TerminalChatViewProvider.js.map