import * as path from 'path';
import { ProjectFile, FileCategory } from '../types';

/** Directories never worth replaying (dependencies, build output, caches). */
export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules', '.git', '.vscode', 'dist', 'build', 'out',
  'target', 'coverage', '.cache', '.next', '.nuxt', 'vendor',
  '__pycache__', '.pytest_cache', '.venv', 'venv', '.env',
];

/** Known binary file extensions */
export const BINARY_EXTENSIONS = [
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
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: FileCategory }> = [
  { pattern: /^package\.json$/i, category: FileCategory.PACKAGE_MANAGER },
  { pattern: /^(requirements\.txt|Pipfile|Gemfile|Cargo\.toml|pom\.xml|composer\.json|go\.mod|go\.sum)$/i, category: FileCategory.PACKAGE_MANAGER },
  { pattern: /^(tsconfig|jsconfig|\.eslintrc|\.prettierrc|\.babelrc|webpack\.config|vite\.config|rollup\.config|jest\.config|vitest\.config|next\.config|nuxt\.config|\.editorconfig).*$/i, category: FileCategory.PROJECT_CONFIG },
  { pattern: /^(Dockerfile|docker-compose|Makefile|Procfile|\.env|\.gitignore|\.dockerignore).*$/i, category: FileCategory.CONFIG },
  { pattern: /\.(test|spec|e2e)\.(ts|tsx|js|jsx|py|rb|go|rs)$/i, category: FileCategory.TEST },
  { pattern: /__tests__/i, category: FileCategory.TEST },
  { pattern: /\.(css|scss|sass|less|styl|styled)$/i, category: FileCategory.STYLE },
  { pattern: /components?\//i, category: FileCategory.COMPONENT },
  { pattern: /\.(md|mdx|txt|rst|adoc)$/i, category: FileCategory.DOCUMENTATION },
  { pattern: /^README/i, category: FileCategory.DOCUMENTATION },
  { pattern: /^(CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)/i, category: FileCategory.DOCUMENTATION },
];

/** A project is replayed the way it is usually built: config, deps, then code. */
const CATEGORY_ORDER: Record<FileCategory, number> = {
  [FileCategory.CONFIG]: 0,
  [FileCategory.PACKAGE_MANAGER]: 1,
  [FileCategory.PROJECT_CONFIG]: 2,
  [FileCategory.SOURCE]: 3,
  [FileCategory.COMPONENT]: 4,
  [FileCategory.STYLE]: 5,
  [FileCategory.TEST]: 6,
  [FileCategory.DOCUMENTATION]: 7,
  [FileCategory.OTHER]: 8,
};

/** Determine the category of a file from its relative path. */
export function categorizeFile(relativePath: string): FileCategory {
  const basename = path.basename(relativePath);
  const match = CATEGORY_PATTERNS.find(
    ({ pattern }) => pattern.test(basename) || pattern.test(relativePath)
  );
  return match?.category ?? FileCategory.SOURCE;
}

/**
 * Sort by category priority, then alphabetically; returns new objects
 * carrying their final `order` index (inputs are left untouched).
 */
export function sortProjectFiles(files: readonly ProjectFile[]): ProjectFile[] {
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
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Normalize separators and strip a leading "./". */
export function normalizeRelativePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
}

/** A path is unsafe when it could escape the workspace root. */
export function isUnsafePath(filePath: string): boolean {
  if (filePath.trim() === '') { return true; }
  if (filePath.startsWith('/') || /^[A-Z]:/i.test(filePath)) { return true; }
  return filePath.split('/').includes('..');
}

/** Build a ProjectFile from already-validated path and raw content. */
export function createProjectFile(relativePath: string, rawContent: string): ProjectFile {
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
