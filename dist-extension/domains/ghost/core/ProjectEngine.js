"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectEngine = void 0;
const types_1 = require("../types");
const logger_1 = require("../infrastructure/logger");
/**
 * Manages the loaded project: file ordering, enable/disable toggles,
 * workflow step generation, and detection of special files that may
 * trigger terminal commands (package.json → npm install, etc.).
 */
/** Files that hint at a dependency-install command. */
const DEPENDENCY_FILE_COMMANDS = {
    'package.json': 'npm install',
    'requirements.txt': 'pip install -r requirements.txt',
    'Cargo.toml': 'cargo build',
    'pom.xml': 'mvn install',
    'composer.json': 'composer install',
    'Gemfile': 'bundle install',
    'go.mod': 'go mod download',
};
function createInstallCommand(command, timeout) {
    return {
        command,
        cwd: '.',
        waitForCompletion: true,
        timeout,
        onFailure: types_1.ErrorOnFailure.CONTINUE,
    };
}
class ProjectEngine {
    files = [];
    commands = new Map();
    logger = logger_1.Logger.getInstance();
    loadFiles(files) {
        this.files = files.map(file => ({ ...file }));
        this.logger.info(`Project loaded: ${files.length} files`);
    }
    getFiles() {
        return this.files.map(file => ({ ...file }));
    }
    getEnabledFiles() {
        return this.files
            .filter(f => f.enabled)
            .map(file => ({ ...file }))
            .sort((a, b) => a.order - b.order);
    }
    toggleFile(filePath, enabled) {
        this.files = this.files.map(file => file.path === filePath ? { ...file, enabled } : file);
    }
    reorderFiles(orderedPaths) {
        const orderByPath = new Map(orderedPaths.map((p, index) => [p, index]));
        this.files = this.files.map(file => {
            const nextOrder = orderByPath.get(file.path);
            return nextOrder !== undefined ? { ...file, order: nextOrder } : file;
        });
    }
    /**
     * Associate a terminal command to run after a specific file is written.
     */
    addCommandAfterFile(filePath, command) {
        this.commands.set(filePath, command);
    }
    removeCommand(filePath) {
        this.commands.delete(filePath);
    }
    /**
     * Detect root-level dependency manifests and suggest install commands.
     * Nested manifests are ignored: the FakeCoder terminal runs at the project
     * root and there is no shell-agnostic way to change directory first.
     */
    detectSuggestedCommands() {
        return this.files
            .filter(file => !file.path.includes('/') && DEPENDENCY_FILE_COMMANDS[file.path])
            .filter(file => !this.commands.has(file.path))
            .map(file => ({ file: file.path, command: DEPENDENCY_FILE_COMMANDS[file.path] }));
    }
    /**
     * Build the complete workflow: WRITE_FILE steps interleaved with the
     * RUN_COMMAND steps registered for them. When autoCommands is given,
     * suggested install commands are added too (each one still requires the
     * user's authorization at execution time).
     */
    buildWorkflow(autoCommands) {
        const commands = new Map(this.commands);
        if (autoCommands) {
            for (const { file, command } of this.detectSuggestedCommands()) {
                commands.set(file, createInstallCommand(command, autoCommands.timeout));
            }
        }
        return this.getEnabledFiles().flatMap(file => {
            const writeStep = { type: types_1.WorkflowStepType.WRITE_FILE, file };
            const command = commands.get(file.path);
            return command
                ? [writeStep, { type: types_1.WorkflowStepType.RUN_COMMAND, command }]
                : [writeStep];
        });
    }
    /**
     * Fingerprint of the enabled files (paths + sizes), used to make sure a
     * saved session is only resumed on the very same project.
     */
    computeProjectSignature() {
        return this.getEnabledFiles()
            .map(f => `${f.path}:${f.content.length}`)
            .join('|');
    }
    /**
     * Compute total character count across all enabled files.
     */
    computeTotalCharacters() {
        return this.getEnabledFiles()
            .reduce((sum, f) => sum + f.content.length, 0);
    }
}
exports.ProjectEngine = ProjectEngine;
//# sourceMappingURL=ProjectEngine.js.map