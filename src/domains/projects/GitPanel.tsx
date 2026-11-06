import React, { useState } from "react";
import { GitBranch, Check, RefreshCw, FileDiff } from "lucide-react";
import { useProjectsStore } from "./projects-store";

export const GitPanel: React.FC = () => {
  const { currentPath, projectName } = useProjectsStore();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    setTimeout(() => {
      setCommitMessage("");
      setIsCommitting(false);
      alert("Changes committed locally.");
    }, 500);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 select-none text-xs">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-300">
            Source Control
          </span>
          <div className="flex items-center space-x-1 text-zinc-400">
            <button
              onClick={() => {}}
              title="Refresh status"
              className="p-1 hover:text-white rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-zinc-400 font-mono text-[11px] bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
          <GitBranch className="w-3.5 h-3.5 text-sky-400" />
          <span>master</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 truncate">{projectName || "Repository"}</span>
        </div>

        <div className="space-y-1.5 pt-1">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Message (Ctrl+Enter to commit)"
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-750 rounded px-2.5 py-1 text-xs outline-none focus:border-sky-500"
          />
          <button
            onClick={handleCommit}
            disabled={isCommitting || !commitMessage.trim()}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-1 bg-sky-500 text-zinc-950 font-semibold rounded hover:bg-sky-400 transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Commit</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Working Tree
        </div>
        {currentPath ? (
          <div className="text-zinc-500 text-[11px] font-mono space-y-1">
            <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-zinc-850 cursor-pointer">
              <FileDiff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-300">Clean working tree</span>
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-[11px]">No repository opened.</div>
        )}
      </div>
    </div>
  );
};

