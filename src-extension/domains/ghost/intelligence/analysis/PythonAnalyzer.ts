import * as path from 'path';
import {
  CodeAnalyzer,
  LanguageKind,
  SourceDocument,
  ProjectManifest,
} from './analyzer-types';
import {
  RawFact,
  RawPredicate,
  CodePosition,
  SymbolId,
  ScopeId,
} from '../knowledge/fact-types';

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
export class PythonAnalyzer implements CodeAnalyzer {
  readonly language: LanguageKind = 'python';
  readonly supportedExtensions = ['.py', '.pyi'];

  canAnalyze(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  analyze(documents: SourceDocument[], manifest?: ProjectManifest): RawFact[] {
    const facts: RawFact[] = [];

    // Extract manifest dependencies if requirements.txt was parsed
    if (manifest?.dependencies) {
      for (const dep of Object.keys(manifest.dependencies)) {
        facts.push({
          predicate: RawPredicate.MANIFEST_DEPENDENCY,
          moduleName: dep,
          isDev: false,
        });
      }
    }

    for (const doc of documents) {
      if (!this.canAnalyze(doc.path)) { continue; }
      this.analyzeDocument(doc, facts);
    }

    return facts;
  }

  formatImportStatement(symbolName: string, targetModule: string, _isDefault = false): string {
    const cleanMod = targetModule.replace(/\.py$/, '').replace(/^\.\//, '');
    return `from ${cleanMod} import ${symbolName}\n`;
  }

  private analyzeDocument(doc: SourceDocument, facts: RawFact[]): void {
    const lines = doc.content.split('\n');
    const declaredInFile = new Set<string>();
    const importedInFile = new Set<string>();

    this.extractImports(lines, doc.path, importedInFile, facts);
    this.extractDeclarations(lines, doc.path, declaredInFile, facts);
    this.extractReferences(lines, doc.path, declaredInFile, importedInFile, facts);
  }

  private extractImports(
    lines: string[],
    filePath: string,
    importedInFile: Set<string>,
    facts: RawFact[]
  ): void {
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
            predicate: RawPredicate.IMPORTS,
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
            predicate: RawPredicate.IMPORTS,
            filePath,
            moduleSpecifier: m,
            importedSymbolName: '*',
            isDefault: true,
          });
        }
      }
    }
  }

  private extractDeclarations(
    lines: string[],
    filePath: string,
    declaredInFile: Set<string>,
    facts: RawFact[]
  ): void {
    const scopeId: ScopeId = filePath;
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

  private recordDeclaration(
    name: string,
    kind: 'function' | 'class',
    line: number,
    filePath: string,
    scopeId: ScopeId,
    declaredInFile: Set<string>,
    facts: RawFact[]
  ): void {
    declaredInFile.add(name);
    const position: CodePosition = { line, character: 0 };
    const symbolId: SymbolId = `${filePath}#${name}@${line}:0`;

    facts.push({
      predicate: RawPredicate.DECLARES,
      symbolId,
      filePath,
      name,
      kind,
      scopeId,
      position,
      isExported: true,
    });

    facts.push({
      predicate: RawPredicate.EXPORTS,
      filePath,
      symbolId,
      name,
      isDefault: false,
    });
  }

  private extractReferences(
    lines: string[],
    filePath: string,
    declaredInFile: Set<string>,
    importedInFile: Set<string>,
    facts: RawFact[]
  ): void {
    const scopeId: ScopeId = filePath;
    const callRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Skip comments, def and class lines for references
      if (line.trim().startsWith('#') || line.trim().startsWith('def ') || line.trim().startsWith('class ')) {
        continue;
      }

      let match: RegExpExecArray | null;
      while ((match = callRegex.exec(line)) !== null) {
        const name = match[1];
        if (PYTHON_KEYWORDS.has(name)) { continue; }

        const col = match.index;
        const position: CodePosition = { line: lineIdx, character: col };

        let resolution: 'local' | 'imported' | 'external' | 'unresolved';

        if (declaredInFile.has(name)) {
          resolution = 'local';
        } else if (PYTHON_BUILTINS.has(name)) {
          resolution = 'external';
        } else if (importedInFile.has(name)) {
          resolution = 'imported';
        } else {
          resolution = 'unresolved';
        }

        facts.push({
          predicate: RawPredicate.REFERENCES,
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
