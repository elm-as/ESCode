import React, { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  LayoutDashboard,
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
  const { loadProfiles, previewMode, setPreviewMode, runtimeStatus, previewUrl, setPreviewUrl } =
    useDeviceStore();
  const { cursor } = useEditorStore();
  const { setOpenModal, scanSdk } = useSdkStore();
  const { appendLog } = useTerminalStore();
  const { items, addDiagnostic } = useDiagnosticsStore();

  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(null);
  const [focusMcCounter, setFocusMcCounter] = useState(0);
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

    const onHostAction = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { action, payload } = detail;
      if (action === "openProject" && typeof payload?.path === "string") {
        await openWorkspace(payload.path);
        setActiveSidebarTab("explorer");
      } else if (action === "runPreview" && typeof payload?.path === "string") {
        await openWorkspace(payload.path);
        const st = useProjectsStore.getState();
        await adapterManager.startProject(st.framework, payload.path);
      } else if (action === "openInSimulator" && typeof payload?.url === "string") {
        setPreviewUrl(payload.url);
      } else if (action === "openExternalUrl" && typeof payload?.url === "string") {
        openUrl(payload.url).catch(() => window.open(payload.url, "_blank"));
      }
    };

    window.addEventListener("elmas:host-action", onHostAction);
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      window.removeEventListener("elmas:host-action", onHostAction);
    };
  }, [
    loadProfiles,
    loadRecentProjects,
    scanSdk,
    appendLog,
    addDiagnostic,
    framework,
    openWorkspace,
    setPreviewUrl,
  ]);

  const handleStartProject = async () => {
    if (!currentPath) {
      setIsOpenFolderDialogOpen(true);
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
    setActiveSidebarTab("explorer");
    setIsOpenFolderDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0c10] text-zinc-100 font-sans select-none overflow-hidden">
      {/* 1. Header Toolbar */}
      <header className="h-10 bg-[#101016] border-b border-zinc-800 flex items-center justify-between px-3 text-xs shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wider text-amber-400">
            <Code2 className="w-4 h-4" />
            <span>ELMAS STUDIO</span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={() => setFocusMcCounter((c) => c + 1)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-zinc-950 font-semibold transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Mission Control</span>
          </button>

          <button
            onClick={() => setIsOpenFolderDialogOpen(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Ouvrir Dossier</span>
          </button>

          {currentPath && (
            <div className="flex items-center space-x-1.5 text-zinc-400 font-mono text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              <span className="text-zinc-200 font-medium">{projectName}</span>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-amber-400 uppercase font-semibold text-[10px]">
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
              className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded font-semibold transition-colors disabled:opacity-40"
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
                  ? "bg-amber-500 text-zinc-950 font-semibold"
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
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>SDK Manager</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        <ActivityBar
          activeTab={activeSidebarTab}
          onSelectTab={setActiveSidebarTab}
          onOpenMissionControl={() => setFocusMcCounter((c) => c + 1)}
          onOpenSdkModal={() => setOpenModal(true)}
        />

        {activeSidebarTab && (
          <aside className="w-64 bg-[#101016] border-r border-zinc-800 flex flex-col shrink-0">
            {activeSidebarTab === "explorer" && <FileExplorer />}
            {activeSidebarTab === "search" && <SearchPanel />}
            {activeSidebarTab === "git" && <GitPanel />}
          </aside>
        )}

        <main className="flex-1 flex min-w-0 bg-[#0c0c10] overflow-hidden">
          <IdeDockviewWorkspace
            onStartProject={handleStartProject}
            onStopProject={handleStopProject}
            focusMissionControlCounter={focusMcCounter}
          />
        </main>
      </div>

      {/* 3. Status Bar */}
      <footer className="h-6 bg-[#060608] border-t border-zinc-800 flex items-center justify-between px-3 text-[11px] text-zinc-400 shrink-0 z-20 font-mono">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 text-amber-400">
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

      {isOpenFolderDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-md shadow-2xl text-xs space-y-3">
            <h3 className="font-semibold text-zinc-200 text-sm">Ouvrir un projet</h3>
            <input
              autoFocus
              type="text"
              value={folderPathInput}
              onChange={(e) => setFolderPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOpenWorkspace(folderPathInput);
                if (e.key === "Escape") setIsOpenFolderDialogOpen(false);
              }}
              placeholder="C:\Users\elmas\Desktop\Projets\mon-projet"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 font-mono outline-none focus:border-amber-500"
            />

            {recentProjects.length > 0 && (
              <div className="max-h-36 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded bg-zinc-950">
                {recentProjects.map((p) => (
                  <div
                    key={p.path}
                    onClick={() => handleOpenWorkspace(p.path)}
                    className="px-2.5 py-1.5 hover:bg-zinc-900 cursor-pointer flex items-center justify-between"
                  >
                    <div className="truncate font-medium text-zinc-300">{p.name}</div>
                    <div className="text-[10px] font-mono text-amber-400 uppercase">
                      {p.framework}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setIsOpenFolderDialogOpen(false)}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300"
              >
                Annuler
              </button>
              <button
                onClick={() => handleOpenWorkspace(folderPathInput)}
                className="px-3 py-1 rounded bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400"
              >
                Ouvrir
              </button>
            </div>
          </div>
        </div>
      )}

      <SdkManagerModal />
    </div>
  );
};

export default App;
