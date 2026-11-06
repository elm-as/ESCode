import React from "react";
import { useTerminalStore } from "./terminal-store";
import { ProblemsView } from "../diagnostics/ProblemsView";
import { AlertCircle, Terminal, FileText, Trash2, ChevronDown } from "lucide-react";
import { useDiagnosticsStore } from "../diagnostics/diagnostics-store";

interface BottomPanelProps {
  onClose: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ onClose }) => {
  const { logs, activeBottomTab, clearLogs, setActiveBottomTab } = useTerminalStore();
  const { items } = useDiagnosticsStore();

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-t border-zinc-800 select-none text-xs">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-3 bg-zinc-900 border-b border-zinc-800 h-8">
        <div className="flex items-center space-x-1 h-full">
          <button
            onClick={() => setActiveBottomTab("output")}
            className={`flex items-center space-x-1.5 px-3 h-full border-b-2 font-medium transition-colors ${
              activeBottomTab === "output"
                ? "border-sky-400 text-sky-400 bg-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>
          <button
            onClick={() => setActiveBottomTab("problems")}
            className={`flex items-center space-x-1.5 px-3 h-full border-b-2 font-medium transition-colors ${
              activeBottomTab === "problems"
                ? "border-sky-400 text-sky-400 bg-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Problems</span>
            {items.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-800/60">
                {items.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveBottomTab("terminal")}
            className={`flex items-center space-x-1.5 px-3 h-full border-b-2 font-medium transition-colors ${
              activeBottomTab === "terminal"
                ? "border-sky-400 text-sky-400 bg-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-zinc-400">
          {activeBottomTab === "output" && (
            <button
              onClick={clearLogs}
              title="Clear Output"
              className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Collapse Panel"
            className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-hidden">
        {activeBottomTab === "problems" && <ProblemsView />}
        {activeBottomTab === "output" && (
          <div className="h-full overflow-y-auto p-3 font-mono text-[11px] bg-zinc-950 text-zinc-300 space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-zinc-600">No output logs yet. Start a project to see live process streams.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`leading-relaxed whitespace-pre-wrap break-all ${
                    log.stream === "stderr" ? "text-amber-400" : "text-zinc-300"
                  }`}
                >
                  <span className="text-zinc-600 mr-2 select-none">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  {log.line}
                </div>
              ))
            )}
          </div>
        )}
        {activeBottomTab === "terminal" && (
          <div className="h-full p-4 font-mono text-xs text-zinc-400 bg-zinc-950 flex flex-col justify-between">
            <div className="text-zinc-500">
              Integrated Process Session: Rust process orchestrator active.
            </div>
            <div className="text-[11px] text-zinc-600">
              Interactive terminal bound to Tauri sub-process manager.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
