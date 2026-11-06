import React, { useState } from "react";
import { Search, FileCode, RefreshCw } from "lucide-react";
import { searchInFiles, SearchResultItem } from "./search-service";
import { useProjectsStore } from "./projects-store";
import { useEditorStore } from "../editor/editor-store";

export const SearchPanel: React.FC = () => {
  const { currentPath } = useProjectsStore();
  const { openFile } = useEditorStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const executeSearch = async () => {
    if (!currentPath || !query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const items = await searchInFiles(currentPath, query);
      setResults(items);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    openFile(item.file_path, item.file_name);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 select-none text-xs">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-300">
          Search in Project
        </span>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") executeSearch();
            }}
            placeholder="Search string (Press Enter)..."
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-750 rounded px-2.5 py-1 text-xs outline-none focus:border-sky-500 pr-7"
          />
          <button
            onClick={executeSearch}
            disabled={isSearching}
            className="absolute right-1.5 top-1.5 text-zinc-400 hover:text-white"
          >
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">
          {results.length > 0 ? `${results.length} occurrences found` : "Case-insensitive substring search"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-850">
        {results.map((item, idx) => (
          <div
            key={`${item.file_path}-${item.line_number}-${idx}`}
            onClick={() => handleSelectResult(item)}
            className="p-2.5 hover:bg-zinc-800/60 cursor-pointer transition-colors space-y-1"
          >
            <div className="flex items-center space-x-1.5 text-sky-400">
              <FileCode className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium">{item.file_name}</span>
              <span className="text-[10px] text-zinc-500 font-mono">:{item.line_number}</span>
            </div>
            <div className="text-[11px] font-mono text-zinc-300 bg-zinc-950/60 px-1.5 py-0.5 rounded truncate border border-zinc-800/40">
              {item.line_content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

