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
exports.registerGhostDomain = registerGhostDomain;
exports.disposeGhostDomain = disposeGhostDomain;
const vscode = __importStar(require("vscode"));
const WorkflowEngine_1 = require("./core/WorkflowEngine");
const config_panel_1 = require("./ui/config-panel");
const progress_panel_1 = require("./ui/progress-panel");
const persistence_1 = require("./infrastructure/persistence");
const logger_1 = require("./infrastructure/logger");
const types_1 = require("./types");
let activeWorkflow;
/**
 * Registers the camouflaged AST Inspector / Ghost Coder domain inside Elmas Studio.
 * Exposes stealth shortcuts (Ctrl+Alt+M, Ctrl+Alt+K) and Terminal Chat triggers.
 */
function registerGhostDomain(context) {
    const logger = logger_1.Logger.getInstance();
    const persistence = new persistence_1.Persistence(context);
    const workflow = new WorkflowEngine_1.WorkflowEngine();
    activeWorkflow = workflow;
    workflow.setPersistence(persistence);
    const savedProject = persistence.getProject();
    if (savedProject.length > 0) {
        workflow.getProjectEngine().loadFiles(savedProject);
    }
    const progressPanel = new progress_panel_1.ProgressPanel('elmasStudio.ghostToggle');
    progressPanel.show();
    workflow.addProgressListener(progress => {
        progressPanel.updateProgress(progress);
    });
    const configPanel = new config_panel_1.ConfigPanel(context.extensionUri, workflow, persistence);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(config_panel_1.ConfigPanel.viewType, configPanel), configPanel, progressPanel, vscode.commands.registerCommand('elmasStudio.ghostConfig', () => {
        configPanel.openOrToggleModalPanel();
    }), vscode.commands.registerCommand('elmasStudio.ghostToggle', async () => {
        await configPanel.toggleQuickSession();
    }), vscode.commands.registerCommand('elmasStudio.ghostManual', async () => {
        await configPanel.toggleQuickSession(types_1.TypingMode.MANUAL);
    }), vscode.commands.registerCommand('elmasStudio.ghostAuto', async () => {
        await configPanel.toggleQuickSession(types_1.TypingMode.AUTO);
    }), vscode.commands.registerCommand('elmasStudio.ghostStop', () => {
        workflow.stop();
        progressPanel.setIdle();
    }));
    logger.info('Inspecteur AST domain registered');
}
function disposeGhostDomain() {
    activeWorkflow?.dispose();
    logger_1.Logger.getInstance().dispose();
}
//# sourceMappingURL=ghost-service.js.map