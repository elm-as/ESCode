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
exports.BINARY_EXTENSIONS = exports.DEFAULT_EXCLUDED_DIRS = void 0;
exports.categorizeFile = categorizeFile;
exports.sortProjectFiles = sortProjectFiles;
exports.normalizeLineEndings = normalizeLineEndings;
exports.normalizeRelativePath = normalizeRelativePath;
exports.isUnsafePath = isUnsafePath;
exports.createProjectFile = createProjectFile;
const path = __importStar(require("path"));
const types_1 = require("../types");
/** Directories never worth replaying (dependencies, build output, caches). */
exports.DEFAULT_EXCLUDED_DIRS = [
    'node_modules', '.git', '.vscode', 'dist', 'build', 'out',
    'target', 'coverage', '.cache', '.next', '.nuxt', 'vendor',
    '__pycache__', '.pytest_cache', '.venv', 'venv', '.env',
];
/** Known binary file extensions */
exports.BINARY_EXTENSIONS = [
    '.exe', '.dll', '.so', '.obj', '.o', '.a', '.lib',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
    '.mp4', '.avi', '.mkv', '.mov', '.wmv',
    '.mp3', '.wav', '.flac', '.ogg', '.aac',
    '.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.pyc', '.pyo', '.class',
    '.lock',
    '.db', '.sqlite', '.sqlite3',
];
/** File category detection patterns, first match wins */
const CATEGORY_PATTERNS = [
    { pattern: /^package\.json$/i, category: types_1.FileCategory.PACKAGE_MANAGER },
    { pattern: /^(requirements\.txt|Pipfile|Gemfile|Cargo\.toml|pom\.xml|composer\.json|go\.mod|go\.sum)$/i, category: types_1.FileCategory.PACKAGE_MANAGER },
    { pattern: /^(tsconfig|jsconfig|\.eslintrc|\.prettierrc|\.babelrc|webpack\.config|vite\.config|rollup\.config|jest\.config|vitest\.config|next\.config|nuxt\.config|\.editorconfig).*$/i, category: types_1.FileCategory.PROJECT_CONFIG },
    { pattern: /^(Dockerfile|docker-compose|Makefile|Procfile|\.env|\.gitignore|\.dockerignore).*$/i, category: types_1.FileCategory.CONFIG },
    { pattern: /\.(test|spec|e2e)\.(ts|tsx|js|jsx|py|rb|go|rs)$/i, category: types_1.FileCategory.TEST },
    { pattern: /__tests__/i, category: types_1.FileCategory.TEST },
    { pattern: /\.(css|scss|sass|less|styl|styled)$/i, category: types_1.FileCategory.STYLE },
    { pattern: /components?\//i, category: types_1.FileCategory.COMPONENT },
    { pattern: /\.(md|mdx|txt|rst|adoc)$/i, category: types_1.FileCategory.DOCUMENTATION },
    { pattern: /^README/i, category: types_1.FileCategory.DOCUMENTATION },
    { pattern: /^(CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)/i, category: types_1.FileCategory.DOCUMENTATION },
];
/** A project is replayed the way it is usually built: config, deps, then code. */
const CATEGORY_ORDER = {
    [types_1.FileCategory.CONFIG]: 0,
    [types_1.FileCategory.PACKAGE_MANAGER]: 1,
    [types_1.FileCategory.PROJECT_CONFIG]: 2,
    [types_1.FileCategory.SOURCE]: 3,
    [types_1.FileCategory.COMPONENT]: 4,
    [types_1.FileCategory.STYLE]: 5,
    [types_1.FileCategory.TEST]: 6,
    [types_1.FileCategory.DOCUMENTATION]: 7,
    [types_1.FileCategory.OTHER]: 8,
};
/** Determine the category of a file from its relative path. */
function categorizeFile(relativePath) {
    const basename = path.basename(relativePath);
    const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(basename) || pattern.test(relativePath));
    return match?.category ?? types_1.FileCategory.SOURCE;
}
/**
 * Sort by category priority, then alphabetically; returns new objects
 * carrying their final `order` index (inputs are left untouched).
 */
function sortProjectFiles(files) {
    return [...files]
        .sort((a, b) => {
        const orderDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
        return orderDiff !== 0 ? orderDiff : a.path.localeCompare(b.path);
    })
        .map((file, index) => ({ ...file, order: index }));
}
/**
 * VS Code documents use a single EOL; typing a lone '\r' would desynchronise
 * character offsets, so every imported content is normalised to LF.
 */
function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
/** Normalize separators and strip a leading "./". */
function normalizeRelativePath(filePath) {
    return filePath
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/+/g, '/');
}
/** A path is unsafe when it could escape the workspace root. */
function isUnsafePath(filePath) {
    if (filePath.trim() === '') {
        return true;
    }
    if (filePath.startsWith('/') || /^[A-Z]:/i.test(filePath)) {
        return true;
    }
    return filePath.split('/').includes('..');
}
/** Build a ProjectFile from already-validated path and raw content. */
function createProjectFile(relativePath, rawContent) {
    const filePath = normalizeRelativePath(relativePath);
    const content = normalizeLineEndings(rawContent);
    return {
        path: filePath,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
        lineCount: content.split('\n').length,
        enabled: true,
        order: 0,
        category: categorizeFile(filePath),
    };
}
//# sourceMappingURL=file-classification.js.map