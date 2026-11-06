import { create } from "zustand";
import { FileNode, RecentProject, SupportedFramework } from "./types";
import {
  createDirectory,
  createFile,
  deleteEntry,
  detectProject,
  fetchRecentProjects,
  readDirectoryTree,
  recordRecentProject,
  renameEntry,
} from "./projects-service";

interface ProjectsState {
  currentPath: string | null;
  projectName: string;
  framework: SupportedFramework;
  fileTree: FileNode[];
  recentProjects: RecentProject[];
  isLoadingTree: boolean;
  expandedFolders: Set<string>;

  openWorkspace: (dirPath: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleFolder: (folderPath: string) => void;
  loadRecentProjects: () => Promise<void>;
  handleCreateFile: (parentPath: string, fileName: string) => Promise<void>;
  handleCreateFolder: (parentPath: string, folderName: string) => Promise<void>;
  handleDeleteEntry: (targetPath: string) => Promise<void>;
  handleRenameEntry: (oldPath: string, newPath: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  currentPath: null,
  projectName: "",
  framework: "unknown",
  fileTree: [],
  recentProjects: [],
  isLoadingTree: false,
  expandedFolders: new Set<string>(),

  openWorkspace: async (dirPath: string) => {
    set({ isLoadingTree: true, currentPath: dirPath });
    try {
      const parts = dirPath.replace(/\\/g, "/").split("/");
      const name = parts[parts.length - 1] || "Workspace";
      
      const [tree, detection] = await Promise.all([
        readDirectoryTree(dirPath, 3),
        detectProject(dirPath),
      ]);

      set({
        projectName: name,
        framework: detection.framework,
        fileTree: tree,
        isLoadingTree: false,
      });

      await recordRecentProject(dirPath, name, detection.framework);
      await get().loadRecentProjects();
    } catch (err) {
      console.error("Failed to open workspace:", err);
      set({ isLoadingTree: false });
    }
  },

  refreshTree: async () => {
    const { currentPath } = get();
    if (!currentPath) return;
    try {
      const tree = await readDirectoryTree(currentPath, 3);
      set({ fileTree: tree });
    } catch (err) {
      console.error("Failed to refresh file tree:", err);
    }
  },

  toggleFolder: (folderPath: string) => {
    set((state) => {
      const next = new Set(state.expandedFolders);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return { expandedFolders: next };
    });
  },

  loadRecentProjects: async () => {
    try {
      const recents = await fetchRecentProjects();
      set({ recentProjects: recents });
    } catch (err) {
      console.error("Failed to load recent projects:", err);
    }
  },

  handleCreateFile: async (parentPath: string, fileName: string) => {
    const separator = parentPath.includes("\\") ? "\\" : "/";
    const fullPath = `${parentPath}${separator}${fileName}`;
    await createFile(fullPath);
    await get().refreshTree();
  },

  handleCreateFolder: async (parentPath: string, folderName: string) => {
    const separator = parentPath.includes("\\") ? "\\" : "/";
    const fullPath = `${parentPath}${separator}${folderName}`;
    await createDirectory(fullPath);
    await get().refreshTree();
  },

  handleDeleteEntry: async (targetPath: string) => {
    await deleteEntry(targetPath);
    await get().refreshTree();
  },

  handleRenameEntry: async (oldPath: string, newPath: string) => {
    await renameEntry(oldPath, newPath);
    await get().refreshTree();
  },
}));
