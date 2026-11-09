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
exports.ProgressPanel = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
/**
 * Displays real-time typing progress in the status bar under a discreet
 * AST / Language Server telemetry label so it blends into the IDE.
 */
class ProgressPanel {
    statusBarItem;
    constructor(toggleCommandId = 'fakecoder.toggleQuick') {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.name = 'Inspecteur AST';
        this.statusBarItem.command = toggleCommandId;
        this.setIdle();
    }
    show() {
        this.statusBarItem.show();
    }
    hide() {
        this.statusBarItem.hide();
    }
    setIdle() {
        this.statusBarItem.text = '$(pulse) AST · Prêt';
        this.statusBarItem.tooltip = 'Inspecteur AST & Flux Syntaxique (Ctrl+Alt+M : Démarrer/Pause · Ctrl+Alt+K : Configurer)';
        this.statusBarItem.show();
    }
    updateProgress(progress) {
        if (progress.state === types_1.EngineState.IDLE || progress.state === types_1.EngineState.COMPLETED || progress.state === types_1.EngineState.CANCELLED) {
            this.setIdle();
            return;
        }
        const stateIcon = this.mapStateToIcon(progress.state);
        const pct = progress.overallProgress.toFixed(0);
        const speed = progress.currentSpeed.toFixed(1);
        this.statusBarItem.text = `${stateIcon} AST · ${pct}% (${speed} c/s)`;
        this.statusBarItem.tooltip = this.buildTooltip(progress);
        this.statusBarItem.show();
    }
    buildTooltip(progress) {
        const elapsed = this.formatDuration(progress.elapsedTime);
        const remaining = this.formatDuration(progress.estimatedRemainingTime);
        return [
            `Cible : ${progress.currentFile}`,
            `Progression fichier : ${progress.fileProgress.toFixed(1)}%`,
            `Jetons : ${progress.charsWritten.toLocaleString()} / ${progress.totalChars.toLocaleString()}`,
            `Global : ${progress.overallProgress.toFixed(1)}%`,
            `Débit : ${progress.currentSpeed.toFixed(1)} c/s`,
            `Écarts / Corrections : ${progress.totalErrors} / ${progress.totalCorrections}`,
            `Écoulé : ${elapsed} · Restant : ${remaining}`,
        ].join('\n');
    }
    mapStateToIcon(state) {
        const icons = {
            [types_1.EngineState.IDLE]: '$(pulse)',
            [types_1.EngineState.PREPARING]: '$(loading~spin)',
            [types_1.EngineState.TYPING]: '$(sync~spin)',
            [types_1.EngineState.PAUSED]: '$(debug-pause)',
            [types_1.EngineState.CORRECTING]: '$(sparkle)',
            [types_1.EngineState.EXECUTING]: '$(terminal)',
            [types_1.EngineState.WAITING_TERMINAL]: '$(loading~spin)',
            [types_1.EngineState.COMPLETED]: '$(check)',
            [types_1.EngineState.CANCELLED]: '$(circle-slash)',
            [types_1.EngineState.ERROR]: '$(warning)',
        };
        return icons[state] ?? '$(pulse)';
    }
    formatDuration(ms) {
        if (ms <= 0) {
            return '—';
        }
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.ProgressPanel = ProgressPanel;
//# sourceMappingURL=progress-panel.js.map