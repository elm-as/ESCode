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
exports.Persistence = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const logger_1 = require("./logger");
const SESSION_KEY = 'fakecoder.session';
const PROJECT_KEY = 'fakecoder.project';
const SIMULATION_MODE_KEY = 'fakecoder.simulationMode';
/**
 * Reads/writes FakeCoder configuration and session state via VS Code APIs.
 * Isolated so no other module needs to depend on vscode.workspace.getConfiguration directly.
 */
class Persistence {
    context;
    logger = logger_1.Logger.getInstance();
    constructor(context) {
        this.context = context;
    }
    // ── Session & project (workspace state) ──────────────
    async saveSession(session) {
        await this.updateState(SESSION_KEY, session);
    }
    getSession() {
        return this.context.workspaceState.get(SESSION_KEY);
    }
    async clearSession() {
        await this.updateState(SESSION_KEY, undefined);
    }
    /** The loaded project is kept so an interrupted session survives a restart. */
    async saveProject(files) {
        await this.updateState(PROJECT_KEY, files);
    }
    getProject() {
        return this.context.workspaceState.get(PROJECT_KEY) ?? [];
    }
    async saveSimulationMode(mode) {
        await this.updateState(SIMULATION_MODE_KEY, mode);
    }
    getSimulationMode() {
        return this.context.workspaceState.get(SIMULATION_MODE_KEY) ?? 'replay';
    }
    // ── Settings ─────────────────────────────────────────
    /** Full session configuration from user settings. */
    readSessionConfig(projectRoot) {
        return {
            typing: this.readTypingConfig(),
            error: this.readErrorConfig(),
            overwriteStrategy: this.readOverwriteStrategy(),
            projectRoot,
            autoExecuteCommands: this.readAutoExecuteCommands(),
            commandTimeout: this.readCommandTimeout(),
        };
    }
    readTypingConfig() {
        const cfg = vscode.workspace.getConfiguration('fakecoder');
        return {
            mode: cfg.get('typingMode', 'manual'),
            speed: cfg.get('speed', 14),
            minDelay: cfg.get('minDelay', 18),
            maxDelay: cfg.get('maxDelay', 260),
            randomness: cfg.get('randomness', 25),
            humanPauses: cfg.get('humanPauses', true),
            pauseProbability: cfg.get('pauseProbability', 15),
        };
    }
    readErrorConfig() {
        const cfg = vscode.workspace.getConfiguration('fakecoder');
        return {
            rate: cfg.get('errorRate', 4),
            keyboardLayout: cfg.get('keyboardLayout', 'azerty'),
            correctionEnabled: cfg.get('correctionEnabled', true),
            correctionDelay: cfg.get('correctionDelay', 'short'),
            deterministicMode: cfg.get('deterministicMode', false),
            seed: cfg.get('seed', 42),
        };
    }
    /** User additions only — FileScanner always merges its built-in defaults. */
    readExcludedDirectories() {
        return vscode.workspace.getConfiguration('fakecoder').get('excludedDirectories', []);
    }
    readExcludedExtensions() {
        return vscode.workspace.getConfiguration('fakecoder').get('excludedExtensions', []);
    }
    readMaxFileSize() {
        return vscode.workspace.getConfiguration('fakecoder').get('maxFileSize', 1048576);
    }
    readOverwriteStrategy() {
        const value = vscode.workspace.getConfiguration('fakecoder').get('overwriteStrategy', 'ask');
        const known = Object.values(types_1.OverwriteStrategy);
        return known.includes(value) ? value : types_1.OverwriteStrategy.ASK;
    }
    readAutoExecuteCommands() {
        return vscode.workspace.getConfiguration('fakecoder').get('autoExecuteCommands', false);
    }
    readCommandTimeout() {
        return vscode.workspace.getConfiguration('fakecoder').get('commandTimeout', 60000);
    }
    async updateState(key, value) {
        try {
            await this.context.workspaceState.update(key, value);
        }
        catch (err) {
            this.logger.error(`Failed to persist ${key}`, err);
        }
    }
}
exports.Persistence = Persistence;
//# sourceMappingURL=persistence.js.map