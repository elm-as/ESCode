import React from "react";
import { useDiagnosticsStore } from "./diagnostics-store";
import { useEditorStore } from "../editor/editor-store";
import { AlertCircle, AlertTriangle, Info, Trash2 } from "lucide-react";

export const ProblemsView: React.FC = () => {
  const { items, filterSeverity, setFilterSeverity, clearDiagnostics } = useDiagnosticsStore();
  const { openFile } = useEditorStore();

  const filteredItems = items.filter((item) => {
    if (filterSeverity === "all") return true;
    return item.severity === filterSeverity;
  });

  const handleItemClick = (item: (typeof items)[0]) => {
    if (!item.filePath) return;
    const parts = item.filePath.replace(/\\/g, "/").split("/");
    const fileName = parts[parts.length - 1] || "source";
    openFile(item.filePath, fileName);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-xs select-none">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-300">Diagnostics & Errors</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
            {filteredItems.length}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-zinc-850 p-0.5 rounded border border-zinc-750 text-[11px]">
            <button
              onClick={() => setFilterSeverity("all")}
              className={`px-1.5 py-0.5 rounded ${
                filterSeverity === "all" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterSeverity("error")}
              className={`px-1.5 py-0.5 rounded ${
                filterSeverity === "error" ? "bg-red-950 text-red-300" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setFilterSeverity("warning")}
              className={`px-1.5 py-0.5 rounded ${
                filterSeverity === "warning" ? "bg-amber-950 text-amber-300" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Warnings
            </button>
          </div>
          <button
            onClick={clearDiagnostics}
            title="Clear list"
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 font-mono text-[11px]">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-xs">
            No issues detected in current workspace.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="px-3 py-2 hover:bg-zinc-900/60 cursor-pointer flex items-start space-x-2 transition-colors"
            >
              {item.severity === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              ) : item.severity === "warning" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center space-x-2 mb-0.5">
                  <span className="text-[10px] uppercase px-1 rounded bg-zinc-800 text-zinc-400">
                    {item.framework}
                  </span>
                  {item.filePath && (
                    <span className="text-zinc-400 truncate hover:text-sky-400 underline">
                      {item.filePath}:{item.line || 1}
                    </span>
                  )}
                </div>
                <div className="text-zinc-200 break-words font-sans">{item.message}</div>
                {item.stack && (
                  <pre className="text-[10px] text-zinc-500 mt-1 overflow-x-auto whitespace-pre-wrap">
                    {item.stack}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
