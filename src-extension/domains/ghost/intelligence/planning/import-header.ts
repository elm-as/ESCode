import * as path from 'path';

/** Lines that bring other modules into scope, across supported languages. */
const IMPORT_LINE = /^\s*(import\b|from\s+[\w.]+\s+import\b|#\s*include\b|export\s+(\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from\b|(const|let|var)\s+[\w{}\s,]+=\s*require\()/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#(?!\s*include)|"""|''')/;

const MODULE_EXTENSIONS = [
  '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.h', '.hpp',
  '/index.ts', '/index.tsx', '/index.js', '/__init__.py',
];

export interface SplitContent {
  /** Leading import block (with its surrounding comments and blank lines) */
  header: string;
  /** Everything after it; header + body === original content */
  body: string;
}

/**
 * Split a file into its leading import block and the rest, at a line
 * boundary, so the body can be typed first and the imports added afterwards
 * — the way developers often add imports once they notice they need them.
 * Returns an empty header when the file has no leading import.
 */
export function splitImportHeader(content: string): SplitContent {
  const lines = content.split('\n');
  let openBrackets = 0;
  let hasImport = false;
  let headerLineCount = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const isImport = IMPORT_LINE.test(line);
    const continuesImport = openBrackets > 0;
    const isFiller = line.trim() === '' || COMMENT_LINE.test(line);
    if (!isImport && !continuesImport && !isFiller) { break; }

    if (isImport || continuesImport) { openBrackets += countBracketBalance(line); }
    hasImport = hasImport || isImport;
    headerLineCount = i + 1;
  }

  if (!hasImport || openBrackets > 0) { return { header: '', body: content }; }
  const splitOffset = lines.slice(0, headerLineCount).join('\n').length + 1;
  return { header: content.slice(0, splitOffset), body: content.slice(splitOffset) };
}

/**
 * Resolve an import specifier to one of the project's files, if it is local.
 * Handles relative ES modules ('./auth'), Python modules ('pkg.auth',
 * '.auth') and C headers ('graphics.h').
 */
export function resolveLocalModule(
  fromPath: string,
  specifier: string,
  projectPaths: ReadonlySet<string>
): string | undefined {
  const fromDir = path.posix.dirname(fromPath);
  const bases = moduleBaseCandidates(fromDir, specifier);
  for (const base of bases) {
    const match = MODULE_EXTENSIONS
      .map(ext => path.posix.normalize(base + ext))
      .find(candidate => candidate !== fromPath && projectPaths.has(candidate));
    if (match) { return match; }
  }
  return undefined;
}

function moduleBaseCandidates(fromDir: string, specifier: string): string[] {
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

function countBracketBalance(line: string): number {
  const opened = (line.match(/[({]/g) ?? []).length;
  const closed = (line.match(/[)}]/g) ?? []).length;
  return opened - closed;
}
