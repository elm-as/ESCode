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
exports.chooseResumeStep = chooseResumeStep;
exports.buildSessionState = buildSessionState;
const vscode = __importStar(require("vscode"));
/**
 * Offers to resume an interrupted replay session of the same project.
 * Resumption restarts the interrupted file from scratch: its buffer only
 * holds a partial draft that may still contain uncorrected typos.
 * @returns the workflow step index to start from (0 = beginning)
 */
async function chooseResumeStep(persistence, steps, projectSignature) {
    const session = persistence?.getSession();
    if (!session || session.projectSignature !== projectSignature) {
        return 0;
    }
    const stepIndex = steps.findIndex(s => s.file?.path === session.currentFilePath);
    if (stepIndex <= 0) {
        return 0;
    }
    const choice = await vscode.window.showInformationMessage(`FakeCoder: resume the interrupted session at "${session.currentFilePath}" `
        + `(file ${session.fileIndex + 1})?`, 'Resume', 'Start over');
    return choice === 'Resume' ? stepIndex : 0;
}
function buildSessionState(checkpoint) {
    return {
        ...checkpoint,
        charIndex: 0,
        pendingErrors: [],
        savedAt: Date.now(),
    };
}
//# sourceMappingURL=session-resume.js.map