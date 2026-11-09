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

/** Standard C library functions and macros recognized as external */
const C_STANDARD_SYMBOLS = new Set([
  'printf', 'fprintf', 'sprintf', 'snprintf', 'puts', 'putchar',
  'scanf', 'sscanf', 'getchar', 'fgets', 'fputs', 'fopen', 'fclose',
  'fread', 'fwrite', 'fseek', 'ftell', 'rewind', 'feof', 'ferror',
  'malloc', 'calloc', 'realloc', 'free', 'abort', 'exit', 'getenv',
  'system', 'abs', 'labs', 'rand', 'srand',
  'memcpy', 'memmove', 'strcpy', 'strncpy', 'strcat', 'strncat',
  'memcmp', 'strcmp', 'strncmp', 'memchr', 'strchr', 'strrchr',
  'strstr', 'strlen', 'memset', 'strerror',
  'assert', 'errno', 'NULL', 'true', 'false', 'size_t', 'int32_t',
  'uint32_t', 'int64_t', 'uint64_t', 'bool',
]);

/** C keywords that must never be treated as identifiers or functions */
const C_KEYWORDS = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default',
  'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
  'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
  'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
  'union', 'unsigned', 'void', 'volatile', 'while', '_Bool', '_Complex',
]);

/**
 * CAnalyzer provides first-order fact extraction for C / C17 codebases.
 * Extracts function prototypes, definitions, structs, `#include` directives
 * and symbol references without external compilation dependencies.
 */
export class CAnalyzer implements CodeAnalyzer {
  readonly language: LanguageKind = 'c';
  readonly supportedExtensions = ['.c', '.h', '.cpp', '.hpp'];

  canAnalyze(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  analyze(documents: SourceDocument[], _manifest?: ProjectManifest): RawFact[] {
    const facts: RawFact[] = [];
    const declarationsByFile = new Map<string, Set<string>>();

    // Pass 1: Extract declarations across all C documents
    for (const doc of documents) {
      if (!this.canAnalyze(doc.path)) { continue; }
      const declared = new Set<string>();
      this.extractDeclarations(doc.content.split('\n'), doc.path, declared, facts);
      declarationsByFile.set(doc.path, declared);
      declarationsByFile.set(path.basename(doc.path), declared);
    }

    // Pass 2: Extract includes and references with cross-file header resolution
    for (const doc of documents) {
      if (!this.canAnalyze(doc.path)) { continue; }
      const lines = doc.content.split('\n');
      const includedHeaders = new Set<string>();
      this.extractIncludes(lines, doc.path, includedHeaders, facts);
      const declaredInFile = declarationsByFile.get(doc.path) ?? new Set<string>();
      this.extractReferences(lines, doc.path, declaredInFile, includedHeaders, declarationsByFile, facts);
    }

    return facts;
  }

  formatImportStatement(symbolName: string, targetModule: string, _isDefault = true): string {
    const header = targetModule.endsWith('.h') ? targetModule : `${targetModule}.h`;
    const cleanHeader = path.basename(header);
    return `#include "${cleanHeader}"\n`;
  }

  private extractIncludes(
    lines: string[],
    filePath: string,
    includedHeaders: Set<string>,
    facts: RawFact[]
  ): void {
    const includeRegex = /^\s*#\s*include\s+["<]([^">]+)[">]/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(includeRegex);
      if (match) {
        const header = match[1];
        includedHeaders.add(header);
        facts.push({
          predicate: RawPredicate.IMPORTS,
          filePath,
          moduleSpecifier: header,
          importedSymbolName: '*',
          isDefault: true,
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
    const isHeader = filePath.endsWith('.h') || filePath.endsWith('.hpp');
    const scopeId: ScopeId = filePath;

    // Pattern for C function definitions and prototypes:
    // [static/extern] [type] [name]([args]) [{ or ;]
    const funcRegex = /^(?:(?:static|extern|inline|void|int|char|bool|size_t|[A-Za-z0-9_]+)\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*[{;]?/;
    // Pattern for typedef struct / enum: typedef struct Name { or typedef struct { ... } Name;
    const typedefRegex = /typedef\s+(?:struct|enum)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s*\{?/;
    const typedefEndRegex = /\}\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const rawLine = lines[lineIdx].trim();
      if (!rawLine || rawLine.startsWith('//') || rawLine.startsWith('/*') || rawLine.startsWith('#')) {
        continue;
      }

      // Check typedef struct
      const tdMatch = rawLine.match(typedefRegex);
      if (tdMatch && tdMatch[1]) {
        this.recordDeclaration(tdMatch[1], 'type', lineIdx, 0, filePath, scopeId, isHeader, declaredInFile, facts);
        continue;
      }

      const tdEndMatch = rawLine.match(typedefEndRegex);
      if (tdEndMatch && tdEndMatch[1]) {
        this.recordDeclaration(tdEndMatch[1], 'type', lineIdx, 0, filePath, scopeId, isHeader, declaredInFile, facts);
        continue;
      }

      // Check function
      const fMatch = rawLine.match(funcRegex);
      if (fMatch && fMatch[1]) {
        const name = fMatch[1];
        if (!C_KEYWORDS.has(name)) {
          const isStatic = rawLine.startsWith('static');
          const isExported = isHeader || !isStatic;
          this.recordDeclaration(name, 'function', lineIdx, 0, filePath, scopeId, isExported, declaredInFile, facts);
        }
      }
    }
  }

  private recordDeclaration(
    name: string,
    kind: 'function' | 'type',
    line: number,
    col: number,
    filePath: string,
    scopeId: ScopeId,
    isExported: boolean,
    declaredInFile: Set<string>,
    facts: RawFact[]
  ): void {
    declaredInFile.add(name);
    const position: CodePosition = { line, character: col };
    const symbolId: SymbolId = `${filePath}#${name}@${line}:${col}`;

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
        isDefault: false,
      });
    }
  }

  private extractReferences(
    lines: string[],
    filePath: string,
    declaredInFile: Set<string>,
    includedHeaders: Set<string>,
    declarationsByFile: Map<string, Set<string>>,
    facts: RawFact[]
  ): void {
    const scopeId: ScopeId = filePath;
    // Match function calls: name(...)
    const callRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Skip comments and preprocessor lines for call extraction
      if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
        continue;
      }

      let match: RegExpExecArray | null;
      while ((match = callRegex.exec(line)) !== null) {
        const name = match[1];
        if (C_KEYWORDS.has(name)) { continue; }

        const col = match.index;
        const position: CodePosition = { line: lineIdx, character: col };

        let resolution: 'local' | 'imported' | 'external' | 'unresolved';

        if (declaredInFile.has(name)) {
          resolution = 'local';
        } else if (C_STANDARD_SYMBOLS.has(name)) {
          resolution = 'external';
        } else if (this.isSymbolInIncludedHeaders(name, includedHeaders, declarationsByFile)) {
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

  private isSymbolInIncludedHeaders(
    name: string,
    includedHeaders: Set<string>,
    declarationsByFile: Map<string, Set<string>>
  ): boolean {
    for (const header of includedHeaders) {
      const baseHeader = path.basename(header);
      const decls = declarationsByFile.get(header) ?? declarationsByFile.get(baseHeader);
      if (decls && decls.has(name)) {
        return true;
      }
    }
    return false;
  }
}
