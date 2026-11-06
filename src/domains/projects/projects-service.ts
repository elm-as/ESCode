import { invoke } from "@tauri-apps/api/core";
import { FileNode, ProjectDetectionResult, RecentProject } from "./types";

/**
 * Reads directory tree up to maxDepth.
 */
export async function readDirectoryTree(dirPath: string, maxDepth: number = 3): Promise<FileNode[]> {
  return await invoke<FileNode[]>("fs_read_dir", {
    path: dirPath,
    maxDepth,
  });
}

/**
 * Reads UTF-8 content of a text file.
 */
export async function readFileContent(filePath: string): Promise<string> {
  return await invoke<string>("fs_read_file", { path: filePath });
}

/**
 * Writes UTF-8 content to a file.
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  await invoke("fs_write_file", { path: filePath, content });
}

/**
 * Creates a new empty file.
 */
export async function createFile(filePath: string): Promise<void> {
  await invoke("fs_create_file", { path: filePath });
}

/**
 * Creates a new directory.
 */
export async function createDirectory(dirPath: string): Promise<void> {
  await invoke("fs_create_dir", { path: dirPath });
}

/**
 * Deletes a file or directory recursively.
 */
export async function deleteEntry(targetPath: string): Promise<void> {
  await invoke("fs_delete", { path: targetPath });
}

/**
 * Renames or moves a file or directory.
 */
export async function renameEntry(oldPath: string, newPath: string): Promise<void> {
  await invoke("fs_rename", { oldPath, newPath });
}

/**
 * Automatically inspects folder manifests to detect framework.
 */
export async function detectProject(projectPath: string): Promise<ProjectDetectionResult> {
  return await invoke<ProjectDetectionResult>("detect_project_type", { projectPath });
}

/**
 * Fetches recent projects stored in SQLite database.
 */
export async function fetchRecentProjects(): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("db_get_recent_projects");
}

/**
 * Records a project in SQLite recent history.
 */
export async function recordRecentProject(path: string, name: string, framework: string): Promise<void> {
  await invoke("db_add_recent_project", { path, name, framework });
}

