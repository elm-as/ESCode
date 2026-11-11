import React, { useMemo, useState } from "react";
import { Command, FolderOpen, Radio, Search, Skull, X } from "lucide-react";
import { useMissionControlStore } from "./mission-control-store";
import { triggerHostAction } from "./transport";

export const CommandPaletteModal: React.FC = () => {
  const {
    isPaletteOpen,
    projects,
    ports,
    setPaletteOpen,
    setActiveModule,
    selectProject,
    killPortPid,
    fetchAllGit,
  } = useMissionControlStore();

  const [query, setQuery] = useState("");

  const matchingProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.stack.toLowerCase().includes(q))
      .slice(0, 8);
  }, [projects, query]);

  const matchingPorts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ports
      .filter(
        (p) =>
          !q ||
          String(p.port).includes(q) ||
          p.processName.toLowerCase().includes(q) ||
          (p.projectName && p.projectName.toLowerCase().includes(q))
      )
      .slice(0, 4);
  }, [ports, query]);

  if (!isPaletteOpen) return null;

  return (
    <div
      onClick={() => setPaletteOpen(false)}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center pt-20 text-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#14141c] border border-zinc-700 rounded shadow-2xl overflow-hidden text-zinc-200"
      >
        <div className="p-3 border-b border-zinc-800 flex items-center space-x-2">
          <Search className="w-4 h-4 text-amber-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setPaletteOpen(false)}
            placeholder="Rechercher un projet, tuer un port (:5173), lancer une commande globale…"
            className="flex-1 bg-transparent text-zinc-100 outline-none text-xs"
          />
          <button onClick={() => setPaletteOpen(false)} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/80">
          {/* Quick Global Commands */}
          <div className="p-2 space-y-1">
            <div className="px-2 py-0.5 text-[10px] uppercase text-zinc-500 font-semibold">
              Actions Globales
            </div>
            <button
              onClick={() => {
                fetchAllGit();
                setActiveModule("git");
                setPaletteOpen(false);
              }}
              className="w-full px-2.5 py-1.5 rounded hover:bg-zinc-800 flex items-center justify-between text-left"
            >
              <span className="flex items-center space-x-2">
                <Command className="w-3.5 h-3.5 text-amber-400" />
                <span>Git : Fetch All Repositories</span>
              </span>
              <span className="font-mono text-[10px] text-zinc-500">git.fetchAll</span>
            </button>
          </div>

          {/* Matching Projects */}
          <div className="p-2 space-y-1">
            <div className="px-2 py-0.5 text-[10px] uppercase text-zinc-500 font-semibold">
              Projets ({matchingProjects.length})
            </div>
            {matchingProjects.map((proj) => (
              <div
                key={proj.id}
                className="px-2.5 py-1.5 rounded hover:bg-zinc-800 flex items-center justify-between"
              >
                <button
                  onClick={() => {
                    selectProject(proj.id);
                    setPaletteOpen(false);
                  }}
                  className="flex items-center space-x-2 text-left flex-1"
                >
                  <span className="font-semibold text-zinc-100">{proj.name}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase rounded bg-zinc-900 text-amber-300">
                    {proj.stack}
                  </span>
                </button>
                <button
                  onClick={() => {
                    triggerHostAction("openProject", { path: proj.path });
                    setPaletteOpen(false);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-semibold flex items-center space-x-1"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Ouvrir</span>
                </button>
              </div>
            ))}
          </div>

          {/* Matching Ports */}
          {matchingPorts.length > 0 && (
            <div className="p-2 space-y-1">
              <div className="px-2 py-0.5 text-[10px] uppercase text-zinc-500 font-semibold">
                Ports en Écoute
              </div>
              {matchingPorts.map((p) => (
                <div
                  key={p.port}
                  className="px-2.5 py-1.5 rounded hover:bg-zinc-800 flex items-center justify-between font-mono"
                >
                  <span className="flex items-center space-x-2">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-amber-400 font-bold tabular-nums">:{p.port}</span>
                    <span className="text-zinc-300">{p.processName}</span>
                  </span>
                  <button
                    onClick={() => {
                      killPortPid(p.pid);
                      setPaletteOpen(false);
                    }}
                    className="px-2 py-0.5 rounded bg-red-900/80 text-red-200 font-sans flex items-center space-x-1"
                  >
                    <Skull className="w-3 h-3" />
                    <span>Kill PID {p.pid}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

