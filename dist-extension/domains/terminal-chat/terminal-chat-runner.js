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
exports.interpretUserChatInput = interpretUserChatInput;
exports.executeChatShellCommand = executeChatShellCommand;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Translates natural French conversational messages or direct shell inputs
 * into an actionable shell command and a friendly human response header.
 */
function interpretUserChatInput(input, cwd) {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    const isFlutter = fs.existsSync(path.join(cwd, "pubspec.yaml"));
    const isNode = fs.existsSync(path.join(cwd, "package.json"));
    if (/^(salut|bonjour|hello|hey|coucou|aide|help|\?)$/i.test(lower)) {
        const projectType = isFlutter ? "Flutter" : isNode ? "Node / Web" : "Mobile / Web";
        return {
            conversationalIntro: `Salut ! Je suis ton terminal interactif Elmas Studio (projet **${path.basename(cwd)}** — ${projectType}).\n` +
                `Tu peux m'écrire normalement (ex: *"état git"*, *"installe les dépendances"*, *"analyse le code"*, *"relance l'aperçu"*) ou m'envoyer directement n'importe quelle commande système.`,
            shellCommand: null,
        };
    }
    if (lower.includes("relance") && (lower.includes("aperçu") || lower.includes("app") || lower.includes("preview"))) {
        return {
            conversationalIntro: "Je relance immédiatement le serveur d'aperçu mobile en direct :",
            shellCommand: null,
            ideCommand: "elmasStudio.runProject",
        };
    }
    if (lower.includes("dépendance") || lower.includes("dependance") || lower === "pub get" || lower === "install") {
        const cmd = isFlutter ? "flutter pub get" : "npm install";
        return {
            conversationalIntro: `J'installe et synchronise les dépendances du projet (\`${cmd}\`) :`,
            shellCommand: cmd,
        };
    }
    if (lower.includes("état git") || lower.includes("etat git") || lower === "status" || lower.includes("changé")) {
        return {
            conversationalIntro: "Voici l'état actuel des fichiers modifiés dans ton dépôt Git :",
            shellCommand: "git status -s",
        };
    }
    if (lower.includes("nettoie") || lower.includes("nettoyer") || lower === "clean") {
        const cmd = isFlutter ? "flutter clean" : "git status -s";
        return {
            conversationalIntro: `Je nettoie les fichiers de build temporaires (\`${cmd}\`) :`,
            shellCommand: cmd,
        };
    }
    if (lower.includes("analyse") || lower.includes("erreurs") || lower.includes("vérifie")) {
        const cmd = isFlutter ? "flutter analyze" : "git status -s";
        return {
            conversationalIntro: `J'analyse le code du projet pour détecter d'éventuels problèmes (\`${cmd}\`) :`,
            shellCommand: cmd,
        };
    }
    if (lower.includes("liste les fichiers") || lower === "fichiers") {
        return {
            conversationalIntro: `Voici le contenu du dossier \`${path.basename(cwd)}\` :`,
            shellCommand: "Get-ChildItem -Name",
        };
    }
    return {
        conversationalIntro: `Exécution de \`${trimmed}\` :`,
        shellCommand: trimmed,
    };
}
/**
 * Executes a shell command in PowerShell with live streaming output callback.
 */
function executeChatShellCommand(command, cwd, onChunk) {
    const startTime = Date.now();
    // Handle 'cd <dir>' directly so working directory persists across chat messages
    const cdMatch = command.match(/^cd\s+(.+)$/i);
    if (cdMatch) {
        const targetRaw = cdMatch[1].trim().replace(/^["']|["']$/g, "");
        const resolved = path.resolve(cwd, targetRaw);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return Promise.resolve({
                exitCode: 0,
                output: `Dossier actif changé vers : ${resolved}`,
                durationMs: Date.now() - startTime,
                newCwd: resolved,
            });
        }
        return Promise.resolve({
            exitCode: 1,
            output: `Le dossier '${targetRaw}' est introuvable.`,
            durationMs: Date.now() - startTime,
            newCwd: cwd,
        });
    }
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
            cwd,
            env: { ...process.env, FORCE_COLOR: "0" },
            windowsHide: true,
        });
        let fullOutput = "";
        const append = (data) => {
            const text = data.toString("utf8");
            fullOutput += text;
            onChunk(fullOutput);
        };
        child.stdout.on("data", append);
        child.stderr.on("data", append);
        child.on("error", (err) => {
            const msg = `Impossible de lancer la commande : ${err.message}`;
            resolve({
                exitCode: 1,
                output: msg,
                durationMs: Date.now() - startTime,
                newCwd: cwd,
            });
        });
        child.on("close", (code) => {
            resolve({
                exitCode: code ?? 0,
                output: fullOutput.trim() || "Commande exécutée avec succès (aucune sortie texte).",
                durationMs: Date.now() - startTime,
                newCwd: cwd,
            });
        });
    });
}
//# sourceMappingURL=terminal-chat-runner.js.map