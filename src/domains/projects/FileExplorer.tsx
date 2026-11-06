import React, { useState } from "react";
import { useProjectsStore } from "./projects-store";
import { FileNode } from "./types";
import { useEditorStore } from "../editor/editor-store";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Trash2,
  RefreshCw,
  FolderPlus,
} from "lucide-react";

export const FileExplorer: React.FC = () => {
  const {
    currentPath,
    projectName,
    framework,
    fileTree,
    isLoadingTree,
    expandedFolders,
    toggleFolder,
    refreshTree,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteEntry,
  } = useProjectsStore();

  const { openFile } = useEditorStore();
  const [newFileInputPath, setNewFileInputPath] = useState<string | null>(null);
  const [newFolderNameInputPath, setNewFolderNameInputPath] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");

  const submitNewFile = async () => {
    if (!newFileInputPath || !itemName.trim()) {
      setNewFileInputPath(null);
      return;
    }
    await handleCreateFile(newFileInputPath, itemName.trim());
    setItemName("");
    setNewFileInputPath(null);
  };

  const submitNewFolder = async () => {
    if (!newFolderNameInputPath || !itemName.trim()) {
      setNewFolderNameInputPath(null);
      return;
    }
    await handleCreateFolder(newFolderNameInputPath, itemName.trim());
    setItemName("");
    setNewFolderNameInputPath(null);
  };

  if (!currentPath) {
    return (
      <div className="p-4 text-xs text-zinc-400 flex flex-col items-center justify-center h-full text-center">
        <Folder className="w-8 h-8 mb-2 text-zinc-500 opacity-60" />
        <p className="mb-2 font-medium">No folder open</p>
        <p className="text-[11px] text-zinc-500">
          Open a project from the top bar to inspect files and start editing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center space-x-1.5 overflow-hidden">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-300 truncate">
            {projectName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-sky-400 font-mono">
            {framework}
          </span>
        </div>
        <div className="flex items-center space-x-1 text-zinc-400">
          <button
            onClick={() => setNewFileInputPath(currentPath)}
            title="New File"
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setNewFolderNameInputPath(currentPath)}
            title="New Folder"
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => refreshTree()}
            title="Refresh Explorer"
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* New File Inline Input */}
      {newFileInputPath && (
        <div className="px-3 py-1.5 bg-zinc-850 border-b border-zinc-800 flex items-center space-x-2">
          <File className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewFile();
              if (e.key === "Escape") setNewFileInputPath(null);
            }}
            onBlur={submitNewFile}
            placeholder="File name (e.g. index.tsx)"
            className="w-full bg-zinc-800 text-zinc-200 text-xs px-1.5 py-0.5 rounded outline-none border border-sky-500/50"
          />
        </div>
      )}

      {/* New Folder Inline Input */}
      {newFolderNameInputPath && (
        <div className="px-3 py-1.5 bg-zinc-850 border-b border-zinc-800 flex items-center space-x-2">
          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewFolder();
              if (e.key === "Escape") setNewFolderNameInputPath(null);
            }}
            onBlur={submitNewFolder}
            placeholder="Folder name"
            className="w-full bg-zinc-800 text-zinc-200 text-xs px-1.5 py-0.5 rounded outline-none border border-amber-500/50"
          />
        </div>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            level={0}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onOpenFile={openFile}
            onDelete={handleDeleteEntry}
          />
        ))}
      </div>
    </div>
  );
};

interface TreeNodeProps {
  node: FileNode;
  level: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string, name: string) => void;
  onDelete: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  onDelete,
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const paddingLeft = `${level * 12 + 12}px`;

  const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".tsx") || lower.endsWith(".ts") || lower.endsWith(".jsx") || lower.endsWith(".js")) {
      return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (lower.endsWith(".dart")) {
      return <FileCode className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    }
    if (lower.endsWith(".kt") || lower.endsWith(".kts")) {
      return <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
    if (lower.endsWith(".json")) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (lower.endsWith(".md") || lower.endsWith(".txt")) {
      return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  if (node.is_dir) {
    return (
      <div>
        <div
          onClick={() => onToggleFolder(node.path)}
          style={{ paddingLeft }}
          className="group flex items-center justify-between py-1 px-2 hover:bg-zinc-800/60 cursor-pointer text-zinc-300 transition-colors"
        >
          <div className="flex items-center space-x-1.5 overflow-hidden">
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path);
            }}
            title="Delete Folder"
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-500 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpenFile(node.path, node.name)}
      style={{ paddingLeft }}
      className="group flex items-center justify-between py-1 px-2 hover:bg-zinc-800/60 cursor-pointer text-zinc-300 transition-colors"
    >
      <div className="flex items-center space-x-1.5 overflow-hidden">
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.path);
        }}
        title="Delete File"
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-500 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

