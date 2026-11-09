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
exports.FileScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../infrastructure/logger");
const file_classification_1 = require("./file-classification");
/** Null bytes in the first 8KB are a reliable binary signature. */
const BINARY_SNIFF_BYTES = 8192;
/**
 * Reads files and folders from disk into ProjectFiles, skipping excluded
 * directories, binary content and oversized files.
 */
class FileScanner {
    excludedDirs;
    excludedExts;
    maxFileSize;
    logger = logger_1.Logger.getInstance();
    constructor(excludedDirs, excludedExts, maxFileSize = 1048576) {
        this.excludedDirs = new Set([...file_classification_1.DEFAULT_EXCLUDED_DIRS, ...(excludedDirs ?? [])]);
        this.excludedExts = new Set([...file_classification_1.BINARY_EXTENSIONS, ...(excludedExts ?? [])]);
        this.maxFileSize = maxFileSize;
    }
    /** Recursively scan a directory and return all eligible text files. */
    async scanDirectory(dirPath) {
        const files = [];
        const excludedCount = await this.scanInto(files, { absolute: dirPath, relative: '' });
        this.logger.info(`Scanned directory: ${files.length} files found, ${excludedCount} excluded`);
        return (0, file_classification_1.sortProjectFiles)(files);
    }
    /**
     * Import individual files. Paths are made relative to the files' common
     * parent so two files with the same name in different folders don't collide.
     */
    async processFiles(filePaths) {
        const root = findCommonDirectory(filePaths);
        const files = [];
        for (const filePath of filePaths) {
            const file = await this.processFile(filePath, path.relative(root, filePath));
            if (file) {
                files.push(file);
            }
        }
        return (0, file_classification_1.sortProjectFiles)(files);
    }
    /** Process a single file into a ProjectFile, or null if it is not eligible. */
    async processFile(absolutePath, relativePath) {
        if (this.excludedExts.has(path.extname(absolutePath).toLowerCase())) {
            return null;
        }
        const buffer = await this.readEligibleFile(absolutePath, relativePath);
        if (!buffer || this.isBinaryBuffer(buffer)) {
            return null;
        }
        return (0, file_classification_1.createProjectFile)(relativePath, buffer.toString('utf-8'));
    }
    isBinaryBuffer(buffer) {
        const checkLength = Math.min(buffer.length, BINARY_SNIFF_BYTES);
        for (let i = 0; i < checkLength; i++) {
            if (buffer[i] === 0) {
                return true;
            }
        }
        return false;
    }
    /** Returns the number of excluded entries. */
    async scanInto(files, location) {
        let entries;
        try {
            entries = await fs.promises.readdir(location.absolute, { withFileTypes: true });
        }
        catch (err) {
            this.logger.warn(`Cannot read directory ${location.absolute}: ${String(err)}`);
            return 0;
        }
        let excluded = 0;
        for (const entry of entries) {
            const child = {
                absolute: path.join(location.absolute, entry.name),
                relative: location.relative ? `${location.relative}/${entry.name}` : entry.name,
            };
            if (entry.isDirectory() && this.excludedDirs.has(entry.name)) {
                excluded++;
            }
            else if (entry.isDirectory()) {
                excluded += await this.scanInto(files, child);
            }
            else if (entry.isFile()) {
                const file = await this.processFile(child.absolute, child.relative);
                if (file) {
                    files.push(file);
                }
                else {
                    excluded++;
                }
            }
        }
        return excluded;
    }
    async readEligibleFile(absolutePath, relativePath) {
        try {
            const stat = await fs.promises.stat(absolutePath);
            if (stat.size > this.maxFileSize) {
                this.logger.warn(`File too large, skipping: ${relativePath} (${stat.size} bytes)`);
                return null;
            }
            return await fs.promises.readFile(absolutePath);
        }
        catch (err) {
            this.logger.warn(`Cannot read file ${relativePath}: ${String(err)}`);
            return null;
        }
    }
}
exports.FileScanner = FileScanner;
function findCommonDirectory(filePaths) {
    if (filePaths.length === 0) {
        return '';
    }
    const splitDirs = filePaths.map(p => path.dirname(path.resolve(p)).split(path.sep));
    const common = [];
    for (let i = 0; i < splitDirs[0].length; i++) {
        const segment = splitDirs[0][i];
        if (!splitDirs.every(parts => parts[i] === segment)) {
            break;
        }
        common.push(segment);
    }
    // A lone root segment ('' on POSIX, 'C:' on Windows) needs its separator back
    return common.length <= 1 ? `${common[0] ?? ''}${path.sep}` : common.join(path.sep);
}
//# sourceMappingURL=FileScanner.js.map