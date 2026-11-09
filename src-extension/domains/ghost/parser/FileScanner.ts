import * as fs from 'fs';
import * as path from 'path';
import { ProjectFile } from '../types';
import { Logger } from '../infrastructure/logger';
import {
  DEFAULT_EXCLUDED_DIRS,
  BINARY_EXTENSIONS,
  createProjectFile,
  sortProjectFiles,
} from './file-classification';

/** Null bytes in the first 8KB are a reliable binary signature. */
const BINARY_SNIFF_BYTES = 8192;

/**
 * Reads files and folders from disk into ProjectFiles, skipping excluded
 * directories, binary content and oversized files.
 */
export class FileScanner {
  private readonly excludedDirs: Set<string>;
  private readonly excludedExts: Set<string>;
  private readonly maxFileSize: number;
  private readonly logger = Logger.getInstance();

  constructor(
    excludedDirs?: string[],
    excludedExts?: string[],
    maxFileSize: number = 1048576
  ) {
    this.excludedDirs = new Set([...DEFAULT_EXCLUDED_DIRS, ...(excludedDirs ?? [])]);
    this.excludedExts = new Set([...BINARY_EXTENSIONS, ...(excludedExts ?? [])]);
    this.maxFileSize = maxFileSize;
  }

  /** Recursively scan a directory and return all eligible text files. */
  async scanDirectory(dirPath: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const excludedCount = await this.scanInto(files, { absolute: dirPath, relative: '' });
    this.logger.info(`Scanned directory: ${files.length} files found, ${excludedCount} excluded`);
    return sortProjectFiles(files);
  }

  /**
   * Import individual files. Paths are made relative to the files' common
   * parent so two files with the same name in different folders don't collide.
   */
  async processFiles(filePaths: string[]): Promise<ProjectFile[]> {
    const root = findCommonDirectory(filePaths);
    const files: ProjectFile[] = [];
    for (const filePath of filePaths) {
      const file = await this.processFile(filePath, path.relative(root, filePath));
      if (file) { files.push(file); }
    }
    return sortProjectFiles(files);
  }

  /** Process a single file into a ProjectFile, or null if it is not eligible. */
  async processFile(absolutePath: string, relativePath: string): Promise<ProjectFile | null> {
    if (this.excludedExts.has(path.extname(absolutePath).toLowerCase())) { return null; }

    const buffer = await this.readEligibleFile(absolutePath, relativePath);
    if (!buffer || this.isBinaryBuffer(buffer)) { return null; }

    return createProjectFile(relativePath, buffer.toString('utf-8'));
  }

  isBinaryBuffer(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, BINARY_SNIFF_BYTES);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) { return true; }
    }
    return false;
  }

  /** Returns the number of excluded entries. */
  private async scanInto(
    files: ProjectFile[],
    location: { absolute: string; relative: string }
  ): Promise<number> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(location.absolute, { withFileTypes: true });
    } catch (err) {
      this.logger.warn(`Cannot read directory ${location.absolute}: ${String(err)}`);
      return 0;
    }

    let excluded = 0;
    for (const entry of entries) {
      const child = {
        absolute: path.join(location.absolute, entry.name),
        relative: location.relative ? `${location.relative}/${entry.name}` : entry.name,
      };
      if (entry.isDirectory() && this.excludedDirs.has(entry.name)) {
        excluded++;
      } else if (entry.isDirectory()) {
        excluded += await this.scanInto(files, child);
      } else if (entry.isFile()) {
        const file = await this.processFile(child.absolute, child.relative);
        if (file) { files.push(file); } else { excluded++; }
      }
    }
    return excluded;
  }

  private async readEligibleFile(absolutePath: string, relativePath: string): Promise<Buffer | null> {
    try {
      const stat = await fs.promises.stat(absolutePath);
      if (stat.size > this.maxFileSize) {
        this.logger.warn(`File too large, skipping: ${relativePath} (${stat.size} bytes)`);
        return null;
      }
      return await fs.promises.readFile(absolutePath);
    } catch (err) {
      this.logger.warn(`Cannot read file ${relativePath}: ${String(err)}`);
      return null;
    }
  }
}

function findCommonDirectory(filePaths: string[]): string {
  if (filePaths.length === 0) { return ''; }
  const splitDirs = filePaths.map(p => path.dirname(path.resolve(p)).split(path.sep));
  const common: string[] = [];
  for (let i = 0; i < splitDirs[0].length; i++) {
    const segment = splitDirs[0][i];
    if (!splitDirs.every(parts => parts[i] === segment)) { break; }
    common.push(segment);
  }
  // A lone root segment ('' on POSIX, 'C:' on Windows) needs its separator back
  return common.length <= 1 ? `${common[0] ?? ''}${path.sep}` : common.join(path.sep);
}
