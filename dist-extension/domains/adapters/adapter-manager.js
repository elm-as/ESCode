"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterManager = exports.ExtensionAdapterManager = void 0;
const react_web_adapter_1 = require("./react-web-adapter");
const react_native_adapter_1 = require("./react-native-adapter");
const flutter_adapter_1 = require("./flutter-adapter");
const kotlin_adapter_1 = require("./kotlin-adapter");
const process_manager_1 = require("../process/process-manager");
class ExtensionAdapterManager {
    adapters = new Map();
    currentRunningAdapter = null;
    currentRunResult = null;
    constructor() {
        this.registerAdapter(new react_web_adapter_1.ReactWebAdapter());
        this.registerAdapter(new react_native_adapter_1.ReactNativeAdapter());
        this.registerAdapter(new flutter_adapter_1.FlutterAdapter());
        this.registerAdapter(new kotlin_adapter_1.KotlinComposeAdapter());
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.framework, adapter);
    }
    getAdapter(framework) {
        return this.adapters.get(framework);
    }
    async detectWorkspaceFramework(workspacePath) {
        for (const [framework, adapter] of this.adapters.entries()) {
            if (await adapter.detectProject(workspacePath)) {
                return framework;
            }
        }
        return "unknown";
    }
    async startProject(workspacePath, mode) {
        const framework = await this.detectWorkspaceFramework(workspacePath);
        if (framework === "unknown") {
            throw new Error("No supported mobile framework detected in workspace.");
        }
        const adapter = this.getAdapter(framework);
        if (!adapter) {
            throw new Error(`No adapter found for framework ${framework}`);
        }
        const validation = await adapter.validateEnvironment(mode);
        if (!validation.valid) {
            throw new Error(validation.reason || "Environment validation failed.");
        }
        if (this.currentRunningAdapter) {
            await this.currentRunningAdapter.stop();
            this.currentRunningAdapter = null;
        }
        const port = await process_manager_1.processManager.allocateFreePort();
        const result = await adapter.start({
            projectPath: workspacePath,
            mode,
            port,
        });
        this.currentRunningAdapter = adapter;
        this.currentRunResult = result;
        return result;
    }
    async stopProject() {
        if (this.currentRunningAdapter) {
            await this.currentRunningAdapter.stop();
            this.currentRunningAdapter = null;
            this.currentRunResult = null;
        }
    }
    getCurrentRunResult() {
        return this.currentRunResult;
    }
    getCurrentAdapter() {
        return this.currentRunningAdapter;
    }
}
exports.ExtensionAdapterManager = ExtensionAdapterManager;
exports.adapterManager = new ExtensionAdapterManager();
//# sourceMappingURL=adapter-manager.js.map