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
export class SemanticAnalyzer implements CodeAnalyzer {
  readonly language: LanguageKind = 'typescript';
  readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.dart'];

  canAnalyze(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  formatImportStatement(symbolName: string, targetModule: string, isDefault = false): string {
    return isDefault
      ? `import ${symbolName} from '${targetModule}';\n`
      : `import { ${symbolName} } from '${targetModule}';\n`;
  }

  analyze(documents: SourceDocument[], manifest?: ProjectManifest): RawFact[] {
    const facts: RawFact[] = [];
    this.extractManifestFacts(manifest, facts);

    for (const doc of documents) {
      if (!this.canAnalyze(doc.path)) { continue; }
      this.analyzeDocument(doc, facts);
    }

    return facts;
  }

  private extractManifestFacts(manifest: ProjectManifest | undefined, facts: RawFact[]): void {
    if (!manifest) { return; }
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      facts.push({ predicate: RawPredicate.MANIFEST_DEPENDENCY, moduleName: dep, isDev: false });
    }
    for (const dep of Object.keys(manifest.devDependencies ?? {})) {
      facts.push({ predicate: RawPredicate.MANIFEST_DEPENDENCY, moduleName: dep, isDev: true });
    }
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
            predicate: RawPredicate.IMPORTS,
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
          predicate: RawPredicate.IMPORTS,
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
          predicate: RawPredicate.IMPORTS,
          filePath,
          moduleSpecifier: ns[2],
          importedSymbolName: '*',
          localAlias: ns[1],
          isDefault: false,
        });
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
    const declRe = /^\s*(export\s+)?(default\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(declRe);
      if (!m) { continue; }
      const isExported = Boolean(m[1]);
      const isDefault = Boolean(m[2]);
      const rawKind = m[3];
      const name = m[4];
      const kind = (rawKind === 'let' || rawKind === 'var' || rawKind === 'const')
        ? 'variable'
        : rawKind as 'function' | 'class' | 'interface' | 'type' | 'enum';
      const position: CodePosition = { line: i, character: 0 };
      const symbolId: SymbolId = `${filePath}#${name}@${i}:0`;

      declaredInFile.add(name);
      facts.push({
        predicate: RawPredicate.DECLARES,
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
          predicate: RawPredicate.EXPORTS,
          filePath,
          symbolId,
          name,
          isDefault,
        });
      }
    }
  }

  private extractReferences(
    lines: string[],
    filePath: string,
    declaredInFile: Set<string>,
    importedInFile: Set<string>,
    facts: RawFact[]
  ): void {
    const scopeId: ScopeId = filePath;
    const callOrTypeRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\(|<)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) {
        continue;
      }

      let m: RegExpExecArray | null;
      while ((m = callOrTypeRe.exec(line)) !== null) {
        const name = m[1];
        if (TS_KEYWORDS.has(name)) { continue; }
        const position: CodePosition = { line: i, character: m.index };
        const resolution = declaredInFile.has(name)
          ? 'local'
          : GLOBAL_IDENTIFIERS.has(name)
            ? 'external'
            : importedInFile.has(name)
              ? 'imported'
              : 'unresolved';

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
