"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectParser = void 0;
const logger_1 = require("../infrastructure/logger");
const file_classification_1 = require("./file-classification");
/** Number of validation errors listed before summarising the rest. */
const MAX_REPORTED_ERRORS = 5;
class ProjectParser {
    logger = logger_1.Logger.getInstance();
    /**
     * Parse a JSON project string into ProjectFiles.
     * Every path is validated so a pasted project can never write outside
     * the workspace. All entry errors are reported together.
     */
    parseProjectJson(jsonString) {
        const raw = parseRawProject(jsonString);
        const files = [];
        const errors = [];
        const seenPaths = new Set();
        raw.files.forEach((entry, index) => {
            const result = validateEntry(entry, index, seenPaths);
            if ('error' in result) {
                errors.push(result.error);
                return;
            }
            seenPaths.add(result.file.path);
            files.push({ ...result.file, order: index });
        });
        if (errors.length > 0) {
            throw new Error(`Project validation errors:\n${summarizeErrors(errors)}`);
        }
        this.logger.info(`Parsed project: ${files.length} files`);
        return (0, file_classification_1.sortProjectFiles)(files);
    }
    /** Parse raw code pasted directly as a single file. */
    parseRawCode(code, filename) {
        const normalizedPath = (0, file_classification_1.normalizeRelativePath)(filename.trim());
        if ((0, file_classification_1.isUnsafePath)(normalizedPath)) {
            throw new Error(`Unsafe filename: "${filename}" (must be a relative path without ..)`);
        }
        return [(0, file_classification_1.createProjectFile)(normalizedPath, code)];
    }
}
exports.ProjectParser = ProjectParser;
function parseRawProject(jsonString) {
    let raw;
    try {
        raw = JSON.parse(jsonString);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown parse error';
        throw new Error(`Invalid JSON: ${message}`);
    }
    if (!raw || typeof raw !== 'object') {
        throw new Error('Project must be a JSON object');
    }
    const files = raw.files;
    if (!Array.isArray(files)) {
        throw new Error('Project must contain a "files" array');
    }
    if (files.length === 0) {
        throw new Error('Project contains no files');
    }
    return { files };
}
function validateEntry(entry, index, seenPaths) {
    if (!entry || typeof entry !== 'object') {
        return { error: `File at index ${index}: must be an object` };
    }
    const { path, content } = entry;
    if (typeof path !== 'string' || path.trim() === '') {
        return { error: `File at index ${index}: missing or empty "path"` };
    }
    if (typeof content !== 'string') {
        return { error: `File at index ${index} (${path}): "content" must be a string` };
    }
    const normalizedPath = (0, file_classification_1.normalizeRelativePath)(path);
    if (seenPaths.has(normalizedPath)) {
        return { error: `Duplicate path: "${normalizedPath}"` };
    }
    if ((0, file_classification_1.isUnsafePath)(normalizedPath)) {
        return { error: `Unsafe path: "${normalizedPath}" (cannot contain .. or absolute paths)` };
    }
    return { file: (0, file_classification_1.createProjectFile)(normalizedPath, content) };
}
function summarizeErrors(errors) {
    if (errors.length <= MAX_REPORTED_ERRORS) {
        return errors.join('\n');
    }
    const shown = errors.slice(0, MAX_REPORTED_ERRORS).join('\n');
    return `${shown}\n... and ${errors.length - MAX_REPORTED_ERRORS} more errors`;
}
//# sourceMappingURL=ProjectParser.js.map