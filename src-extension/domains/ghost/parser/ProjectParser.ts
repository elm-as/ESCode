import { ProjectFile } from '../types';
import { Logger } from '../infrastructure/logger';
import {
  createProjectFile,
  isUnsafePath,
  normalizeRelativePath,
  sortProjectFiles,
} from './file-classification';

/** Number of validation errors listed before summarising the rest. */
const MAX_REPORTED_ERRORS = 5;

/**
 * Expected JSON format for a pasted project:
 * { "files": [ { "path": "src/main.ts", "content": "..." }, ... ] }
 */
interface RawProject {
  files: unknown[];
}

type EntryValidation = { file: ProjectFile } | { error: string };

export class ProjectParser {
  private readonly logger = Logger.getInstance();

  /**
   * Parse a JSON project string into ProjectFiles.
   * Every path is validated so a pasted project can never write outside
   * the workspace. All entry errors are reported together.
   */
  parseProjectJson(jsonString: string): ProjectFile[] {
    const raw = parseRawProject(jsonString);
    const files: ProjectFile[] = [];
    const errors: string[] = [];
    const seenPaths = new Set<string>();

    raw.files.forEach((entry, index) => {
      const result = validateEntry(entry, index, seenPaths);
      if ('error' in result) {
        errors.push(result.error);
        return;
      }
      seenPaths.add(result.file.path);
      files.push({ ...result.file, order: index });
    });

    if (errors.length > 0) {
      throw new Error(`Project validation errors:\n${summarizeErrors(errors)}`);
    }

    this.logger.info(`Parsed project: ${files.length} files`);
    return sortProjectFiles(files);
  }

  /** Parse raw code pasted directly as a single file. */
  parseRawCode(code: string, filename: string): ProjectFile[] {
    const normalizedPath = normalizeRelativePath(filename.trim());
    if (isUnsafePath(normalizedPath)) {
      throw new Error(`Unsafe filename: "${filename}" (must be a relative path without ..)`);
    }
    return [createProjectFile(normalizedPath, code)];
  }
}

function parseRawProject(jsonString: string): RawProject {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    throw new Error(`Invalid JSON: ${message}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Project must be a JSON object');
  }
  const files = (raw as { files?: unknown }).files;
  if (!Array.isArray(files)) {
    throw new Error('Project must contain a "files" array');
  }
  if (files.length === 0) {
    throw new Error('Project contains no files');
  }
  return { files };
}

function validateEntry(entry: unknown, index: number, seenPaths: Set<string>): EntryValidation {
  if (!entry || typeof entry !== 'object') {
    return { error: `File at index ${index}: must be an object` };
  }
  const { path, content } = entry as { path?: unknown; content?: unknown };

  if (typeof path !== 'string' || path.trim() === '') {
    return { error: `File at index ${index}: missing or empty "path"` };
  }
  if (typeof content !== 'string') {
    return { error: `File at index ${index} (${path}): "content" must be a string` };
  }

  const normalizedPath = normalizeRelativePath(path);
  if (seenPaths.has(normalizedPath)) {
    return { error: `Duplicate path: "${normalizedPath}"` };
  }
  if (isUnsafePath(normalizedPath)) {
    return { error: `Unsafe path: "${normalizedPath}" (cannot contain .. or absolute paths)` };
  }
  return { file: createProjectFile(normalizedPath, content) };
}

function summarizeErrors(errors: string[]): string {
  if (errors.length <= MAX_REPORTED_ERRORS) { return errors.join('\n'); }
  const shown = errors.slice(0, MAX_REPORTED_ERRORS).join('\n');
  return `${shown}\n... and ${errors.length - MAX_REPORTED_ERRORS} more errors`;
}
