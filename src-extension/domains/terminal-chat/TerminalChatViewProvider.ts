import * as vscode from "vscode";
import * as path from "path";
import { ChatMessageItem, renderTerminalChatHtml } from "./terminal-chat-html";
import { executeChatShellCommand, interpretUserChatInput } from "./terminal-chat-runner";

export class TerminalChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "elmasStudio.terminalChat";

  private currentView?: vscode.WebviewView;
  private messages: ChatMessageItem[] = [];
  private activeCwd: string = "";

  constructor() {
    this.activeCwd = this.resolveInitialCwd();
    this.seedWelcomeMessage();
  }

  private resolveInitialCwd(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return process.cwd();
  }

  private formatClockNow(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  private seedWelcomeMessage(): void {
    this.messages = [
      {
        id: "welcome-1",
        role: "assistant",
        text: "Bonjour ! Que souhaites-tu faire ?",
        timestamp: this.formatClockNow(),
      },
    ];
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.activeCwd = this.resolveInitialCwd();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "sendChatCommand" && typeof msg.text === "string") {
        await this.handleUserMessage(msg.text);
      } else if (msg.type === "clearChat") {
        this.seedWelcomeMessage();
        this.syncWebview();
      }
    });

    const projectName = path.basename(this.activeCwd || "Projet");
    webviewView.webview.html = renderTerminalChatHtml(projectName, this.messages);
  }

  private async handleUserMessage(rawText: string): Promise<void> {
    if (!this.activeCwd) {
      this.activeCwd = this.resolveInitialCwd();
    }

    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      text: rawText,
      timestamp: this.formatClockNow(),
    };
    this.messages.push(userMsg);

    const translation = interpretUserChatInput(rawText, this.activeCwd);
    const replyId = `a-${Date.now()}`;
    const replyMsg: ChatMessageItem = {
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

    const result = await executeChatShellCommand(
      translation.shellCommand,
      this.activeCwd,
      (cleanedText, isServerReady) => {
        replyMsg.codeOutput = cleanedText;
        if (isServerReady) {
          replyMsg.status = "success";
        }
        this.syncWebview();
      }
    );

    this.activeCwd = result.newCwd;
    replyMsg.codeOutput = result.output;
    replyMsg.durationMs = result.durationMs;
    replyMsg.status = result.exitCode === 0 ? "success" : "error";
    this.syncWebview();
  }

  private syncWebview(): void {
    if (!this.currentView) return;
    this.currentView.webview.postMessage({
      type: "syncMessages",
      messages: this.messages,
      projectName: path.basename(this.activeCwd || "Projet"),
    });
  }
}
