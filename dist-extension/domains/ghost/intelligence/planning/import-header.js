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
exports.splitImportHeader = splitImportHeader;
exports.resolveLocalModule = resolveLocalModule;
const path = __importStar(require("path"));
/** Lines that bring other modules into scope, across supported languages. */
const IMPORT_LINE = /^\s*(import\b|from\s+[\w.]+\s+import\b|#\s*include\b|export\s+(\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from\b|(const|let|var)\s+[\w{}\s,]+=\s*require\()/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#(?!\s*include)|"""|''')/;
const MODULE_EXTENSIONS = [
    '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.h', '.hpp',
    '/index.ts', '/index.tsx', '/index.js', '/__init__.py',
];
/**
 * Split a file into its leading import block and the rest, at a line
 * boundary, so the body can be typed first and the imports added afterwards
 * — the way developers often add imports once they notice they need them.
 * Returns an empty header when the file has no leading import.
 */
function splitImportHeader(content) {
    const lines = content.split('\n');
    let openBrackets = 0;
    let hasImport = false;
    let headerLineCount = 0;
    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const isImport = IMPORT_LINE.test(line);
        const continuesImport = openBrackets > 0;
        const isFiller = line.trim() === '' || COMMENT_LINE.test(line);
        if (!isImport && !continuesImport && !isFiller) {
            break;
        }
        if (isImport || continuesImport) {
            openBrackets += countBracketBalance(line);
        }
        hasImport = hasImport || isImport;
        headerLineCount = i + 1;
    }
    if (!hasImport || openBrackets > 0) {
        return { header: '', body: content };
    }
    const splitOffset = lines.slice(0, headerLineCount).join('\n').length + 1;
    return { header: content.slice(0, splitOffset), body: content.slice(splitOffset) };
}
/**
 * Resolve an import specifier to one of the project's files, if it is local.
 * Handles relative ES modules ('./auth'), Python modules ('pkg.auth',
 * '.auth') and C headers ('graphics.h').
 */
function resolveLocalModule(fromPath, specifier, projectPaths) {
    const fromDir = path.posix.dirname(fromPath);
    const bases = moduleBaseCandidates(fromDir, specifier);
    for (const base of bases) {
        const match = MODULE_EXTENSIONS
            .map(ext => path.posix.normalize(base + ext))
            .find(candidate => candidate !== fromPath && projectPaths.has(candidate));
        if (match) {
            return match;
        }
    }
    return undefined;
}
function moduleBaseCandidates(fromDir, specifier) {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
        return [path.posix.join(fromDir, specifier)];
    }
    if (/^\.+\w/.test(specifier)) {
        const asPath = specifier.replace(/^\.+/, '').replace(/\./g, '/');
        return [path.posix.join(fromDir, asPath)];
    }
    const dotted = specifier.replace(/\.(?!h$|hpp$)/g, '/');
    return [path.posix.join(fromDir, specifier), specifier, dotted];
}
function countBracketBalance(line) {
    const opened = (line.match(/[({]/g) ?? []).length;
    const closed = (line.match(/[)}]/g) ?? []).length;
    return opened - closed;
}
//# sourceMappingURL=import-header.js.map