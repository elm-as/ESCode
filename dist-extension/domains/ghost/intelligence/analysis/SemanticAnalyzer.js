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
exports.SemanticAnalyzer = void 0;
const path = __importStar(require("path"));
const fact_types_1 = require("../knowledge/fact-types");
const TS_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'typeof',
    'instanceof', 'void', 'delete', 'in', 'of', 'await', 'async', 'function',
    'class', 'interface', 'type', 'enum', 'const', 'let', 'var', 'import',
    'export', 'from', 'as', 'extends', 'implements', 'super', 'this', 'true',
    'false', 'null', 'undefined',
]);
const GLOBAL_IDENTIFIERS = new Set([
    'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
    'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error',
    'TypeError', 'RangeError', 'SyntaxError', 'Buffer', 'process', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'fetch', 'URL', 'window',
    'document', 'navigator', 'localStorage', 'sessionStorage', 'React',
]);
/**
 * Zero-dependency TypeScript / JavaScript / Dart semantic analyzer.
 * Extracts imports, exported declarations, and symbol references so
 * DevelopmentTrajectoryBuilder works inside standalone Elmas Studio
 * without bundling the 9MB TypeScript compiler.
 */
class SemanticAnalyzer {
    language = 'typescript';
    supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.dart'];
    canAnalyze(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }
    formatImportStatement(symbolName, targetModule, isDefault = false) {
        return isDefault
            ? `import ${symbolName} from '${targetModule}';\n`
            : `import { ${symbolName} } from '${targetModule}';\n`;
    }
    analyze(documents, manifest) {
        const facts = [];
        this.extractManifestFacts(manifest, facts);
        for (const doc of documents) {
            if (!this.canAnalyze(doc.path)) {
                continue;
            }
            this.analyzeDocument(doc, facts);
        }
        return facts;
    }
    extractManifestFacts(manifest, facts) {
        if (!manifest) {
            return;
        }
        for (const dep of Object.keys(manifest.dependencies ?? {})) {
            facts.push({ predicate: fact_types_1.RawPredicate.MANIFEST_DEPENDENCY, moduleName: dep, isDev: false });
        }
        for (const dep of Object.keys(manifest.devDependencies ?? {})) {
            facts.push({ predicate: fact_types_1.RawPredicate.MANIFEST_DEPENDENCY, moduleName: dep, isDev: true });
        }
    }
    analyzeDocument(doc, facts) {
        const lines = doc.content.split('\n');
        const declaredInFile = new Set();
        const importedInFile = new Set();
        this.extractImports(lines, doc.path, importedInFile, facts);
        this.extractDeclarations(lines, doc.path, declaredInFile, facts);
        this.extractReferences(lines, doc.path, declaredInFile, importedInFile, facts);
    }
    extractImports(lines, filePath, importedInFile, facts) {
        const namedImportRe = /^\s*import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
        const defaultImportRe = /^\s*import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/;
        const namespaceImportRe = /^\s*import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/;
        for (const line of lines) {
            const named = line.match(namedImportRe);
            if (named) {
                const mod = named[2];
                const specs = named[1].split(',').map(s => s.trim()).filter(Boolean);
                for (const spec of specs) {
                    const clean = spec.replace(/^type\s+/, '');
                    const [orig, alias] = clean.split(/\s+as\s+/).map(s => s.trim());
                    importedInFile.add(alias || orig);
                    facts.push({
                        predicate: fact_types_1.RawPredicate.IMPORTS,
                        filePath,
                        moduleSpecifier: mod,
                        importedSymbolName: orig,
                        localAlias: alias,
                        isDefault: false,
                    });
                }
                continue;
            }
            const def = line.match(defaultImportRe);
            if (def) {
                importedInFile.add(def[1]);
                facts.push({
                    predicate: fact_types_1.RawPredicate.IMPORTS,
                    filePath,
                    moduleSpecifier: def[2],
                    importedSymbolName: def[1],
                    isDefault: true,
                });
                continue;
            }
            const ns = line.match(namespaceImportRe);
            if (ns) {
                importedInFile.add(ns[1]);
                facts.push({
                    predicate: fact_types_1.RawPredicate.IMPORTS,
                    filePath,
                    moduleSpecifier: ns[2],
                    importedSymbolName: '*',
                    localAlias: ns[1],
                    isDefault: false,
                });
            }
        }
    }
    extractDeclarations(lines, filePath, declaredInFile, facts) {
        const scopeId = filePath;
        const declRe = /^\s*(export\s+)?(default\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(declRe);
            if (!m) {
                continue;
            }
            const isExported = Boolean(m[1]);
            const isDefault = Boolean(m[2]);
            const rawKind = m[3];
            const name = m[4];
            const kind = (rawKind === 'let' || rawKind === 'var' || rawKind === 'const')
                ? 'variable'
                : rawKind;
            const position = { line: i, character: 0 };
            const symbolId = `${filePath}#${name}@${i}:0`;
            declaredInFile.add(name);
            facts.push({
                predicate: fact_types_1.RawPredicate.DECLARES,
                symbolId,
                filePath,
                name,
                kind,
                scopeId,
                position,
                isExported,
            });
            if (isExported) {
                facts.push({
                    predicate: fact_types_1.RawPredicate.EXPORTS,
                    filePath,
                    symbolId,
                    name,
                    isDefault,
                });
            }
        }
    }
    extractReferences(lines, filePath, declaredInFile, importedInFile, facts) {
        const scopeId = filePath;
        const callOrTypeRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\(|<)/g;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) {
                continue;
            }
            let m;
            while ((m = callOrTypeRe.exec(line)) !== null) {
                const name = m[1];
                if (TS_KEYWORDS.has(name)) {
                    continue;
                }
                const position = { line: i, character: m.index };
                const resolution = declaredInFile.has(name)
                    ? 'local'
                    : GLOBAL_IDENTIFIERS.has(name)
                        ? 'external'
                        : importedInFile.has(name)
                            ? 'imported'
                            : 'unresolved';
                facts.push({
                    predicate: fact_types_1.RawPredicate.REFERENCES,
                    filePath,
                    name,
                    scopeId,
                    position,
                    resolution,
                });
            }
        }
    }
}
exports.SemanticAnalyzer = SemanticAnalyzer;
//# sourceMappingURL=SemanticAnalyzer.js.map