"use strict";
// ─── Enums ───────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCategory = exports.ErrorType = exports.WorkflowStepType = exports.CorrectionDelay = exports.ErrorOnFailure = exports.OverwriteStrategy = exports.EngineState = exports.TypingMode = void 0;
var TypingMode;
(function (TypingMode) {
    TypingMode["AUTO"] = "auto";
    TypingMode["MANUAL"] = "manual";
})(TypingMode || (exports.TypingMode = TypingMode = {}));
var EngineState;
(function (EngineState) {
    EngineState["IDLE"] = "idle";
    EngineState["PREPARING"] = "preparing";
    EngineState["TYPING"] = "typing";
    EngineState["PAUSED"] = "paused";
    EngineState["CORRECTING"] = "correcting";
    EngineState["EXECUTING"] = "executing";
    EngineState["WAITING_TERMINAL"] = "waitingTerminal";
    EngineState["COMPLETED"] = "completed";
    EngineState["CANCELLED"] = "cancelled";
    EngineState["ERROR"] = "error";
})(EngineState || (exports.EngineState = EngineState = {}));
var OverwriteStrategy;
(function (OverwriteStrategy) {
    OverwriteStrategy["REPLACE"] = "replace";
    OverwriteStrategy["APPEND"] = "append";
    OverwriteStrategy["INSERT"] = "insert";
    OverwriteStrategy["OVERWRITE_FROM_CURSOR"] = "overwriteFromCursor";
    OverwriteStrategy["CLEAR_THEN_TYPE"] = "clearThenType";
    OverwriteStrategy["IGNORE"] = "ignore";
    OverwriteStrategy["ASK"] = "ask";
})(OverwriteStrategy || (exports.OverwriteStrategy = OverwriteStrategy = {}));
var ErrorOnFailure;
(function (ErrorOnFailure) {
    ErrorOnFailure["STOP"] = "stop";
    ErrorOnFailure["CONTINUE"] = "continue";
    ErrorOnFailure["RETRY"] = "retry";
    ErrorOnFailure["PAUSE"] = "pause";
})(ErrorOnFailure || (exports.ErrorOnFailure = ErrorOnFailure = {}));
var CorrectionDelay;
(function (CorrectionDelay) {
    CorrectionDelay["IMMEDIATE"] = "immediate";
    CorrectionDelay["SHORT"] = "short";
    CorrectionDelay["MEDIUM"] = "medium";
    CorrectionDelay["LONG"] = "long";
})(CorrectionDelay || (exports.CorrectionDelay = CorrectionDelay = {}));
var WorkflowStepType;
(function (WorkflowStepType) {
    WorkflowStepType["WRITE_FILE"] = "writeFile";
    WorkflowStepType["RUN_COMMAND"] = "runCommand";
    WorkflowStepType["WAIT"] = "wait";
})(WorkflowStepType || (exports.WorkflowStepType = WorkflowStepType = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["ADJACENT_KEY"] = "adjacentKey";
    ErrorType["OMITTED_CHAR"] = "omittedChar";
    ErrorType["REPEATED_CHAR"] = "repeatedChar";
    ErrorType["WRONG_CHAR"] = "wrongChar";
    ErrorType["MISSING_SPACE"] = "missingSpace";
    ErrorType["EXTRA_SPACE"] = "extraSpace";
    ErrorType["WRONG_PUNCTUATION"] = "wrongPunctuation";
    ErrorType["WRONG_CASE"] = "wrongCase";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
var FileCategory;
(function (FileCategory) {
    FileCategory["CONFIG"] = "config";
    FileCategory["PACKAGE_MANAGER"] = "packageManager";
    FileCategory["PROJECT_CONFIG"] = "projectConfig";
    FileCategory["SOURCE"] = "source";
    FileCategory["COMPONENT"] = "component";
    FileCategory["STYLE"] = "style";
    FileCategory["TEST"] = "test";
    FileCategory["DOCUMENTATION"] = "documentation";
    FileCategory["OTHER"] = "other";
})(FileCategory || (exports.FileCategory = FileCategory = {}));
//# sourceMappingURL=index.js.map