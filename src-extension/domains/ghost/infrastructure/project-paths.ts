import * as path from 'path';

/**
 * Resolve a project-relative path against the workspace root, refusing any
 * result outside it. Imports are validated already; this is the last line of
 * defence before a file is created (e.g. a tampered persisted project).
 */
export function resolveProjectPath(projectRoot: string, relativePath: string): string {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative === '' || relative.split(path.sep)[0] === '..' || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside the workspace: ${relativePath}`);
  }
  return resolved;
}
