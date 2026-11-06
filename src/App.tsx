import React, { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjectsStore } from "./domains/projects/projects-store";
import { useDeviceStore } from "./domains/preview/device-store";
import { useEditorStore } from "./domains/editor/editor-store";
import { useSdkStore } from "./domains/sdk/sdk-store";
import { useTerminalStore } from "./domains/terminal/terminal-store";
import { useDiagnosticsStore } from "./domains/diagnostics/diagnostics-store";
import { adapterManager } from "./domains/adapters/adapter-manager";
import { ActivityBar, SidebarTab } from "./domains/shell/ActivityBar";
import { FileExplorer } from "./domains/projects/FileExplorer";
import { SearchPanel } from "./domains/projects/SearchPanel";
import { GitPanel } from "./domains/projects/GitPanel";
import { IdeDockviewWorkspace } from "./domains/shell/IdeDockviewWorkspace";
import { SdkManagerModal } from "./domains/sdk/SdkManagerModal";
import {
  FolderOpen,
  Layers,
  Play,
  Square,
  AlertCircle,
  Zap,
  Smartphone,
  ChevronRight,
  Code2,
} from "lucide-react";

interface ProcessOutputPayload {
  process_id: string;
  stream: "stdout" | "stderr";
  line: string;
}

export const App: React.FC = () => {
  const { currentPath, projectName, framework, openWorkspace, loadRecentProjects, recentProjects } =
    useProjectsStore();
  const { loadProfiles, previewMode, setPreviewMode, runtimeStatus, previewUrl } = useDeviceStore();
  const { cursor } = useEditorStore();
  const { setOpenModal, scanSdk } = useSdkStore();
  const { appendLog } = useTerminalStore();
  const { items, addDiagnostic } = useDiagnosticsStore();

  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("explorer");
  const [isOpenFolderDialogOpen, setIsOpenFolderDialogOpen] = useState(false);
  const [folderPathInput, setFolderPathInput] = useState("");

  useEffect(() => {
    loadProfiles();
    loadRecentProjects();
    scanSdk();

    const unlistenPromise = listen<ProcessOutputPayload>("process_output", (event) => {
      const { process_id, stream, line } = event.payload;
      appendLog(process_id, stream, line);

      if (stream === "stderr" || line.toLowerCase().includes("error:")) {
        addDiagnostic({
          framework: framework !== "unknown" ? framework : "Build System",
          severity: "error",
          message: line,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [loadProfiles, loadRecentProjects, scanSdk, appendLog, addDiagnostic, framework]);

  const handleStartProject = async () => {
    if (!currentPath) {
      alert("Please open a project directory first.");
      return;
    }
    try {
      await adapterManager.startProject(framework, currentPath);
    } catch (err) {
      console.error("Failed to start project:", err);
    }
  };

  const handleStopProject = async () => {
    await adapterManager.stopCurrentProject();
  };

  const handleOpenWorkspace = async (path: string) => {
    if (!path.trim()) return;
    await openWorkspace(path.trim());
    setIsOpenFolderDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden">
      {/* 1. Header Toolbar */}
      <header className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 text-xs shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wider text-sky-400">
            <Code2 className="w-4 h-4" />
            <span>ELMAS STUDIO</span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={() => setIsOpenFolderDialogOpen(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </button>

          {currentPath && (
            <div className="flex items-center space-x-1.5 text-zinc-400 font-mono text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              <span className="text-zinc-200 font-medium">{projectName}</span>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-sky-400 uppercase font-semibold text-[10px]">
                {framework}
              </span>
            </div>
          )}
        </div>

        {/* Center: Run / Stop & Fast/Native Toggle */}
        <div className="flex items-center space-x-2">
          {runtimeStatus === "running" ? (
            <button
              onClick={handleStopProject}
              className="flex items-center space-x-1.5 px-3 py-1 bg-red-950/80 border border-red-700/80 text-red-300 hover:bg-red-900 rounded font-medium transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop Preview</span>
            </button>
          ) : (
            <button
              onClick={handleStartProject}
              disabled={runtimeStatus === "starting" || !currentPath}
              className="flex items-center space-x-1.5 px-3 py-1 bg-sky-500 text-zinc-950 hover:bg-sky-400 rounded font-semibold transition-colors disabled:opacity-40"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run Preview</span>
            </button>
          )}

          <div className="flex items-center bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[11px]">
            <button
              onClick={() => setPreviewMode("fast")}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 transition-colors ${
                previewMode === "fast"
                  ? "bg-sky-500 text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>FAST</span>
            </button>
            <button
              onClick={() => setPreviewMode("native")}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 transition-colors ${
                previewMode === "native"
                  ? "bg-amber-500 text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>NATIVE</span>
            </button>
          </div>
        </div>

        {/* Right: SDK Manager */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>SDK Manager</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar
          activeTab={activeSidebarTab}
          onSelectTab={setActiveSidebarTab}
          onOpenSdkModal={() => setOpenModal(true)}
        />

        {/* Primary Sidebar Drawer (Collapsible) */}
        {activeSidebarTab && (
          <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
            {activeSidebarTab === "explorer" && <FileExplorer />}
            {activeSidebarTab === "search" && <SearchPanel />}
            {activeSidebarTab === "git" && <GitPanel />}
          </aside>
        )}

        {/* Professional Dockview Multi-pane Workspace */}
        <main className="flex-1 flex min-w-0 bg-zinc-950 overflow-hidden">
          <IdeDockviewWorkspace
            onStartProject={handleStartProject}
            onStopProject={handleStopProject}
          />
        </main>
      </div>

      {/* 3. Status Bar */}
      <footer className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 text-[11px] text-zinc-400 shrink-0 z-20 font-mono">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 text-sky-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                runtimeStatus === "running" ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <span className="uppercase text-[10px]">{framework}</span>
          </span>
          {previewUrl && (
            <span className="text-zinc-500 tabular-nums">Preview: {previewUrl}</span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {items.length > 0 && (
            <span className="text-red-400 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              <span>{items.length} problems</span>
            </span>
          )}
          <span className="tabular-nums">
            Ln {cursor.lineNumber}, Col {cursor.column}
          </span>
          <div className="h-3 w-px bg-zinc-800" />
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
      </footer>

      {/* Open Folder Modal */}
      {isOpenFolderDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-750 rounded-lg p-4 w-full max-w-md shadow-2xl text-xs space-y-3">
            <h3 className="font-semibold text-zinc-200 text-sm">Open Workspace Directory</h3>
            <p className="text-zinc-400 text-[11px]">
              Enter the absolute path to a React, React Native, Flutter, or Kotlin project:
            </p>
            <input
              autoFocus
              type="text"
              value={folderPathInput}
              onChange={(e) => setFolderPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOpenWorkspace(folderPathInput);
                if (e.key === "Escape") setIsOpenFolderDialogOpen(false);
              }}
              placeholder="e.g. C:\Users\user\Projects\my-mobile-app"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 font-mono outline-none focus:border-sky-500"
            />

            {recentProjects.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Recent Projects
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded bg-zinc-950">
                  {recentProjects.map((p) => (
                    <div
                      key={p.path}
                      onClick={() => handleOpenWorkspace(p.path)}
                      className="px-2.5 py-1.5 hover:bg-zinc-900 cursor-pointer flex items-center justify-between"
                    >
                      <div className="truncate font-medium text-zinc-300">{p.name}</div>
                      <div className="text-[10px] font-mono text-sky-400 uppercase">
                        {p.framework}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setIsOpenFolderDialogOpen(false)}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-750"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOpenWorkspace(folderPathInput)}
                className="px-3 py-1 rounded bg-sky-500 text-zinc-950 font-semibold hover:bg-sky-400"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SDK Manager Modal */}
      <SdkManagerModal />
    </div>
  );
};

export default App;
