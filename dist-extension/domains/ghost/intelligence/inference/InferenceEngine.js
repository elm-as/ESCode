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
exports.InferenceEngine = void 0;
const path = __importStar(require("path"));
/** Node.js core modules that do not need to be in package.json dependencies */
const NODE_CORE_MODULES = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
    'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
    'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'stream/promises',
    'string_decoder', 'timers', 'timers/promises', 'tls', 'trace_events',
    'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);
const NPM_MANAGED_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
/**
 * InferenceEngine applies first-order declarative rules over the KnowledgeBase
 * to deduce problems, diagnostics, and opportunities (Findings).
 *
 * Rules are domain-independent and do not contain hardcoded symbol names.
 */
class InferenceEngine {
    /**
     * Run all inference rules over the given KnowledgeBase and return findings.
     * @param kb Knowledge base populated with raw facts
     */
    inferFindings(kb) {
        const findings = [];
        this.inferMissingImports(kb, findings);
        this.inferMissingDependencies(kb, findings);
        this.inferUnusedImports(kb, findings);
        return findings;
    }
    /**
     * Rule R1 (Missing Import):
     * For every unresolved reference to symbol S in file F, if symbol S is exported
     * by another project file D, and F does not import S, infer MissingImportFinding.
     */
    inferMissingImports(kb, out) {
        const unresolvedRefs = kb.getUnresolvedReferences();
        // Group by file and symbol name to avoid duplicate findings for repeated references
        const seen = new Set();
        for (const ref of unresolvedRefs) {
            const key = `${ref.filePath}:${ref.name}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const matchingExports = kb.getExportsByName(ref.name);
            // Filter out exports from the referencing file itself
            const validExports = matchingExports.filter(exp => exp.filePath !== ref.filePath);
            if (validExports.length > 0) {
                const targetExport = validExports[0];
                const relativeModule = this.computeRelativeModulePath(ref.filePath, targetExport.filePath);
                out.push({
                    kind: 'missing-import',
                    severity: 'error',
                    sourceFile: ref.filePath,
                    location: ref.position,
                    description: `Symbol '${ref.name}' is referenced in '${ref.filePath}' but not imported. Defined in '${targetExport.filePath}'.`,
                    relatedSymbolName: ref.name,
                    relatedSymbolId: targetExport.symbolId,
                    targetFile: targetExport.filePath,
                    targetModule: relativeModule,
                    evidence: [
                        `References(${ref.filePath}, ${ref.name})`,
                        `Exports(${targetExport.filePath}, ${ref.name})`,
                    ],
                });
            }
            else {
                out.push({
                    kind: 'unresolved-symbol',
                    severity: 'warning',
                    sourceFile: ref.filePath,
                    location: ref.position,
                    description: `Symbol '${ref.name}' is referenced in '${ref.filePath}' but has no known declaration or export.`,
                    relatedSymbolName: ref.name,
                    evidence: [`References(${ref.filePath}, ${ref.name})`],
                });
            }
        }
    }
    /**
     * Rule R2 (Missing Dependency):
     * For every external module imported in a JS/TS file F, if the module is not a Node.js
     * built-in and is not declared in package.json, infer MissingDependencyFinding.
     */
    inferMissingDependencies(kb, out) {
        // package.json only governs JavaScript/TypeScript imports (not Python or C)
        const allFiles = kb.getAllFiles().filter(file => NPM_MANAGED_FILE.test(file));
        const seen = new Set();
        for (const file of allFiles) {
            const imports = kb.getImportsByFile(file);
            for (const imp of imports) {
                const mod = imp.moduleSpecifier;
                // Skip relative paths
                if (mod.startsWith('.') || mod.startsWith('/')) {
                    continue;
                }
                const packageName = this.extractPackageName(mod);
                if (NODE_CORE_MODULES.has(packageName) || packageName.startsWith('node:')) {
                    continue;
                }
                const key = `${file}:${packageName}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                if (!kb.hasManifestDependency(packageName)) {
                    out.push({
                        kind: 'missing-dependency',
                        severity: 'error',
                        sourceFile: file,
                        description: `Module '${packageName}' is imported in '${file}' but missing from manifest dependencies.`,
                        targetModule: packageName,
                        evidence: [
                            `Imports(${file}, ${mod})`,
                            `NotManifestDependency(${packageName})`,
                        ],
                    });
                }
            }
        }
    }
    /**
     * Rule R3 (Unused Import):
     * For every symbol imported in file F, if no reference in F uses the imported name
     * or alias, infer UnusedImportFinding.
     */
    inferUnusedImports(kb, out) {
        const allFiles = kb.getAllFiles();
        for (const file of allFiles) {
            const imports = kb.getImportsByFile(file);
            const references = kb.getReferencesByFile(file);
            const referencedNames = new Set(references.map(r => r.name));
            for (const imp of imports) {
                const symbolToLookup = imp.localAlias ?? imp.importedSymbolName;
                if (!referencedNames.has(symbolToLookup)) {
                    out.push({
                        kind: 'unused-import',
                        severity: 'info',
                        sourceFile: file,
                        description: `Imported symbol '${symbolToLookup}' from '${imp.moduleSpecifier}' is never referenced in '${file}'.`,
                        relatedSymbolName: symbolToLookup,
                        targetModule: imp.moduleSpecifier,
                        evidence: [
                            `Imports(${file}, ${symbolToLookup})`,
                            `NotReferenced(${file}, ${symbolToLookup})`,
                        ],
                    });
                }
            }
        }
    }
    /**
     * Compute relative TypeScript module import specifier between two file paths.
     * e.g., 'src/server.ts' importing 'src/auth.ts' -> './auth'
     */
    computeRelativeModulePath(fromFile, toFile) {
        const fromDir = path.dirname(fromFile.replace(/\\/g, '/'));
        const toPath = toFile.replace(/\\/g, '/');
        let rel = path.relative(fromDir, toPath).replace(/\\/g, '/');
        // Strip extension (.ts, .tsx, .js, .jsx)
        rel = rel.replace(/\.[^/.]+$/, '');
        // Ensure leading ./ or ../
        if (!rel.startsWith('.')) {
            rel = `./${rel}`;
        }
        return rel;
    }
    extractPackageName(moduleSpecifier) {
        if (moduleSpecifier.startsWith('@')) {
            // Scoped package e.g. @types/node or @vscode/test-electron
            const parts = moduleSpecifier.split('/');
            return parts.slice(0, 2).join('/');
        }
        return moduleSpecifier.split('/')[0];
    }
}
exports.InferenceEngine = InferenceEngine;
//# sourceMappingURL=InferenceEngine.js.map