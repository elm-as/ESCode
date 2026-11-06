import React, { useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import { useEditorStore } from "./editor-store";
import { X, Circle, FileCode, Save } from "lucide-react";

export const EditorView: React.FC = () => {
  const {
    tabs,
    activeTabId,
    settings,
    setActiveTab,
    closeTab,
    updateContent,
    saveActiveFile,
    setCursorPosition,
  } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Global Ctrl+S shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveFile]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 select-none">
        <FileCode className="w-12 h-12 mb-3 text-zinc-600 opacity-40" />
        <p className="text-sm font-medium text-zinc-400 mb-1">No File Open</p>
        <p className="text-xs text-zinc-600 mb-4">
          Select a file from the explorer or create a new file to begin.
        </p>
        <div className="flex flex-col space-y-1.5 text-[11px] text-zinc-500 font-mono bg-zinc-900/50 p-3 rounded border border-zinc-800">
          <div><span className="text-sky-400">Ctrl + S</span> — Save active file</div>
          <div><span className="text-sky-400">Ctrl + P</span> — Quick file search</div>
          <div><span className="text-sky-400">Ctrl + W</span> — Close current tab</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Tabs Header */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto select-none no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center space-x-2 px-3 py-1.5 text-xs border-r border-zinc-800 cursor-pointer transition-colors max-w-[200px] ${
                isActive
                  ? "bg-zinc-950 text-sky-400 border-t-2 border-t-sky-400"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
              }`}
            >
              <span className="truncate">{tab.fileName}</span>
              <div className="flex items-center space-x-1 shrink-0">
                {tab.isDirty && (
                  <Circle className="w-2 h-2 fill-sky-400 text-sky-400" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Breadcrumb Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-925 border-b border-zinc-800 text-[11px] text-zinc-500 select-none">
        <div className="truncate font-mono">
          {activeTab.filePath.replace(/\\/g, " / ")}
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[10px] uppercase font-mono px-1 rounded bg-zinc-800 text-zinc-400">
            {activeTab.language}
          </span>
          {activeTab.isDirty && (
            <button
              onClick={() => saveActiveFile()}
              className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[11px]"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <MonacoEditor
          height="100%"
          language={activeTab.language}
          theme="vs-dark"
          value={activeTab.content}
          onChange={(value) => updateContent(activeTab.id, value || "")}
          onMount={(editor) => {
            editor.onDidChangeCursorPosition((e) => {
              setCursorPosition({
                lineNumber: e.position.lineNumber,
                column: e.position.column,
              });
            });
          }}
          options={{
            fontSize: settings.fontSize,
            tabSize: settings.tabSize,
            wordWrap: settings.wordWrap,
            minimap: { enabled: settings.minimap },
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            lineNumbers: "on",
            renderWhitespace: "selection",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
          }}
        />
      </div>
    </div>
  );
};
