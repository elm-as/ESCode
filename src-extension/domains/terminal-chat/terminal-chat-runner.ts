import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface ChatCommandTranslation {
  conversationalIntro: string;
  shellCommand: string | null;
  ideCommand?: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  output: string;
  durationMs: number;
  newCwd: string;
}

/**
 * Strips all ANSI escape sequences and terminal control codes from stdout/stderr.
 */
export function cleanTerminalOutput(raw: string): string {
  return raw
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/**
 * Translates natural French messages or direct shell commands into actions.
 */
export function interpretUserChatInput(input: string, cwd: string): ChatCommandTranslation {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const isFlutter = fs.existsSync(path.join(cwd, "pubspec.yaml"));

  if (/^(salut|bonjour|hello|hey|coucou|yo)$/i.test(lower)) {
    return {
      conversationalIntro: "Bonjour ! Tout est prêt, que souhaites-tu lancer ?",
      shellCommand: null,
    };
  }

  if (/^(aide|help|\?)$/i.test(lower)) {
    return {
      conversationalIntro:
        "Tu peux taper directement une commande (`pnpm run dev`, `git status`, `flutter pub get`) ou écrire simplement : *état git*, *dépendances*, *analyser*, *nettoyer*.",
      shellCommand: null,
    };
  }

  if (lower.includes("relance") && (lower.includes("aperçu") || lower.includes("app") || lower.includes("preview"))) {
    return {
      conversationalIntro: "Aperçu mobile relancé.",
      shellCommand: null,
      ideCommand: "elmasStudio.runProject",
    };
  }

  if (lower.includes("dépendance") || lower.includes("dependance") || lower === "pub get" || lower === "install") {
    const cmd = isFlutter ? "flutter pub get" : "pnpm install";
    return {
      conversationalIntro: `Synchronisation des dépendances (${cmd})`,
      shellCommand: cmd,
    };
  }

  if (lower.includes("état git") || lower.includes("etat git") || lower === "status") {
    return {
      conversationalIntro: "État Git du projet",
      shellCommand: "git status -s",
    };
  }

  if (lower.includes("nettoie") || lower.includes("nettoyer") || lower === "clean") {
    const cmd = isFlutter ? "flutter clean" : "git status -s";
    return {
      conversationalIntro: `Nettoyage (${cmd})`,
      shellCommand: cmd,
    };
  }

  if (lower.includes("analyse") || lower.includes("erreurs") || lower.includes("vérifie")) {
    const cmd = isFlutter ? "flutter analyze" : "npx tsc --noEmit";
    return {
      conversationalIntro: `Analyse du code (${cmd})`,
      shellCommand: cmd,
    };
  }

  return {
    conversationalIntro: "",
    shellCommand: trimmed,
  };
}

/**
 * Executes a shell command in UTF-8 PowerShell with ANSI-cleaned streaming output.
 */
export function executeChatShellCommand(
  command: string,
  cwd: string,
  onChunk: (cleanedText: string, isServerReady: boolean) => void
): Promise<CommandExecutionResult> {
  const startTime = Date.now();

  const cdMatch = command.match(/^cd\s+(.+)$/i);
  if (cdMatch) {
    const targetRaw = cdMatch[1].trim().replace(/^["']|["']$/g, "");
    const resolved = path.resolve(cwd, targetRaw);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return Promise.resolve({
        exitCode: 0,
        output: `Dossier actif : ${resolved}`,
        durationMs: Date.now() - startTime,
        newCwd: resolved,
      });
    }
    return Promise.resolve({
      exitCode: 1,
      output: `Dossier introuvable : ${targetRaw}`,
      durationMs: Date.now() - startTime,
      newCwd: cwd,
    });
  }

  return new Promise((resolve) => {
    const utf8Command = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", utf8Command], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb" },
      windowsHide: true,
    });

    let rawOutput = "";

    const append = (data: Buffer) => {
      rawOutput += data.toString("utf8");
      const cleaned = cleanTerminalOutput(rawOutput);
      const isReady = /localhost:\d+|127\.0\.0\.1:\d+|ready in \d+/i.test(cleaned);
      onChunk(cleaned, isReady);
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    child.on("error", (err) => {
      resolve({
        exitCode: 1,
        output: `Erreur : ${err.message}`,
        durationMs: Date.now() - startTime,
        newCwd: cwd,
      });
    });

    child.on("close", (code) => {
      const cleaned = cleanTerminalOutput(rawOutput);
      resolve({
        exitCode: code ?? 0,
        output: cleaned || "Terminé.",
        durationMs: Date.now() - startTime,
        newCwd: cwd,
      });
    });
  });
}
