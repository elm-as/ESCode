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
exports.PythonAnalyzer = void 0;
const path = __importStar(require("path"));
const fact_types_1 = require("../knowledge/fact-types");
/** Python built-in functions and types resolved as external */
const PYTHON_BUILTINS = new Set([
    'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list',
    'dict', 'set', 'tuple', 'open', 'type', 'isinstance', 'issubclass',
    'enumerate', 'zip', 'filter', 'map', 'sorted', 'reversed', 'sum',
    'min', 'max', 'abs', 'round', 'any', 'all', 'id', 'hash', 'input',
    'repr', 'format', 'dir', 'vars', 'callable', 'getattr', 'setattr',
    'hasattr', 'delattr', 'super', 'property', 'classmethod', 'staticmethod',
    'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError',
    'AttributeError', 'RuntimeError', 'StopIteration', 'None', 'True', 'False',
]);
/** Python keywords that cannot be function calls or declarations */
const PYTHON_KEYWORDS = new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
    'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
    'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);
/**
 * PythonAnalyzer extracts functions, classes, imports and calls
 * from Python (.py, .pyi) files without external interpreter dependencies.
 */
class PythonAnalyzer {
    language = 'python';
    supportedExtensions = ['.py', '.pyi'];
    canAnalyze(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }
    analyze(documents, manifest) {
        const facts = [];
        // Extract manifest dependencies if requirements.txt was parsed
        if (manifest?.dependencies) {
            for (const dep of Object.keys(manifest.dependencies)) {
                facts.push({
                    predicate: fact_types_1.RawPredicate.MANIFEST_DEPENDENCY,
                    moduleName: dep,
                    isDev: false,
                });
            }
        }
        for (const doc of documents) {
            if (!this.canAnalyze(doc.path)) {
                continue;
            }
            this.analyzeDocument(doc, facts);
        }
        return facts;
    }
    formatImportStatement(symbolName, targetModule, _isDefault = false) {
        const cleanMod = targetModule.replace(/\.py$/, '').replace(/^\.\//, '');
        return `from ${cleanMod} import ${symbolName}\n`;
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
        const fromImportRegex = /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+([^#\n]+)/;
        const directImportRegex = /^\s*import\s+([A-Za-z0-9_., ]+)/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match: from module import symbol1, symbol2 as alias
            const fromMatch = line.match(fromImportRegex);
            if (fromMatch) {
                const mod = fromMatch[1];
                const symbols = fromMatch[2].split(',').map(s => s.trim());
                for (const sym of symbols) {
                    const parts = sym.split(/\s+as\s+/);
                    const origName = parts[0].trim();
                    const alias = parts[1] ? parts[1].trim() : undefined;
                    importedInFile.add(alias ?? origName);
                    facts.push({
                        predicate: fact_types_1.RawPredicate.IMPORTS,
                        filePath,
                        moduleSpecifier: mod,
                        importedSymbolName: origName,
                        localAlias: alias,
                        isDefault: false,
                    });
                }
                continue;
            }
            // Match: import module1, module2
            const directMatch = line.match(directImportRegex);
            if (directMatch) {
                const mods = directMatch[1].split(',').map(m => m.trim());
                for (const m of mods) {
                    importedInFile.add(m);
                    facts.push({
                        predicate: fact_types_1.RawPredicate.IMPORTS,
                        filePath,
                        moduleSpecifier: m,
                        importedSymbolName: '*',
                        isDefault: true,
                    });
                }
            }
        }
    }
    extractDeclarations(lines, filePath, declaredInFile, facts) {
        const scopeId = filePath;
        const defRegex = /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
        const classRegex = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*\([^)]*\))?\s*:/;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            const defMatch = line.match(defRegex);
            if (defMatch) {
                const name = defMatch[1];
                if (!name.startsWith('__')) {
                    this.recordDeclaration(name, 'function', lineIdx, filePath, scopeId, declaredInFile, facts);
                }
                continue;
            }
            const classMatch = line.match(classRegex);
            if (classMatch) {
                const name = classMatch[1];
                this.recordDeclaration(name, 'class', lineIdx, filePath, scopeId, declaredInFile, facts);
            }
        }
    }
    recordDeclaration(name, kind, line, filePath, scopeId, declaredInFile, facts) {
        declaredInFile.add(name);
        const position = { line, character: 0 };
        const symbolId = `${filePath}#${name}@${line}:0`;
        facts.push({
            predicate: fact_types_1.RawPredicate.DECLARES,
            symbolId,
            filePath,
            name,
            kind,
            scopeId,
            position,
            isExported: true,
        });
        facts.push({
            predicate: fact_types_1.RawPredicate.EXPORTS,
            filePath,
            symbolId,
            name,
            isDefault: false,
        });
    }
    extractReferences(lines, filePath, declaredInFile, importedInFile, facts) {
        const scopeId = filePath;
        const callRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            // Skip comments, def and class lines for references
            if (line.trim().startsWith('#') || line.trim().startsWith('def ') || line.trim().startsWith('class ')) {
                continue;
            }
            let match;
            while ((match = callRegex.exec(line)) !== null) {
                const name = match[1];
                if (PYTHON_KEYWORDS.has(name)) {
                    continue;
                }
                const col = match.index;
                const position = { line: lineIdx, character: col };
                let resolution;
                if (declaredInFile.has(name)) {
                    resolution = 'local';
                }
                else if (PYTHON_BUILTINS.has(name)) {
                    resolution = 'external';
                }
                else if (importedInFile.has(name)) {
                    resolution = 'imported';
                }
                else {
                    resolution = 'unresolved';
                }
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
exports.PythonAnalyzer = PythonAnalyzer;
//# sourceMappingURL=PythonAnalyzer.js.map