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
exports.cleanTerminalOutput = cleanTerminalOutput;
exports.interpretUserChatInput = interpretUserChatInput;
exports.executeChatShellCommand = executeChatShellCommand;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Strips all ANSI escape sequences and terminal control codes from stdout/stderr.
 */
function cleanTerminalOutput(raw) {
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
function interpretUserChatInput(input, cwd) {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    const isFlutter = fs.existsSync(path.join(cwd, "pubspec.yaml"));
    if (/^(salut|bonjour|hello|hey|coucou|yo)$/i.test(lower)) {
        return {
            conversationalIntro: "Bonjour ! Tout est prêt, que souhaites-tu lancer ?",
            shellCommand: null,
        };
    }
    if (/^(ghost|ast|inspecteur ast)$/i.test(lower)) {
        return {
            conversationalIntro: "Ouverture de l'Inspecteur AST & Flux Syntaxique.",
            shellCommand: null,
            ideCommand: "elmasStudio.ghostConfig",
        };
    }
    if (/^(magique|clavier magique|ghost manual|ast manual)$/i.test(lower)) {
        return {
            conversationalIntro: "Synchronisation du tampon syntaxique (mode interactif activé — frappez au clavier).",
            shellCommand: null,
            ideCommand: "elmasStudio.ghostManual",
        };
    }
    if (/^(ghost auto|ast auto|autopilote)$/i.test(lower)) {
        return {
            conversationalIntro: "Flux syntaxique continu activé.",
            shellCommand: null,
            ideCommand: "elmasStudio.ghostAuto",
        };
    }
    if (/^(ghost stop|ast stop)$/i.test(lower)) {
        return {
            conversationalIntro: "Flux syntaxique interrompu.",
            shellCommand: null,
            ideCommand: "elmasStudio.ghostStop",
        };
    }
    if (/^(aide|help|\?)$/i.test(lower)) {
        return {
            conversationalIntro: "Tu peux taper directement une commande (`pnpm run dev`, `git status`, `flutter pub get`) ou écrire simplement : *état git*, *dépendances*, *analyser*, *nettoyer*.",
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
function executeChatShellCommand(command, cwd, onChunk) {
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
        const child = (0, child_process_1.spawn)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", utf8Command], {
            cwd,
            env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb" },
            windowsHide: true,
        });
        let rawOutput = "";
        const append = (data) => {
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
//# sourceMappingURL=terminal-chat-runner.js.map