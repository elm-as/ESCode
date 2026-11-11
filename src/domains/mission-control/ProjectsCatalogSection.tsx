import React, { useMemo, useState } from "react";
import {
  FolderPlus,
  Kanban,
  ListFilter,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMissionControlStore } from "./mission-control-store";
import { ProjectStatus } from "./types";
import { formatRelativeTimestamp } from "./transport";
import { ALL_STATUSES, ProjectTableRow, STATUS_LABELS } from "./ProjectTableRow";

export const ProjectsCatalogSection: React.FC = () => {
  const {
    projects,
    scanRoots,
    searchQuery,
    statusFilter,
    stackFilter,
    projectViewMode,
    setSearchQuery,
    setStatusFilter,
    setStackFilter,
    setProjectViewMode,
    selectProject,
    updateProject,
    addManualProject,
    addScanRoot,
    removeScanRoot,
  } = useMissionControlStore();

  const [newPathInput, setNewPathInput] = useState("");
  const [showRootsManager, setShowRootsManager] = useState(false);

  const availableStacks = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => set.add(p.stack));
    return Array.from(set).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (p.isIgnored) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (stackFilter !== "all" && p.stack !== stackFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.stack.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projects, searchQuery, statusFilter, stackFilter]);

  const handleAddPath = async (asRoot: boolean) => {
    if (!newPathInput.trim()) return;
    if (asRoot) {
      await addScanRoot(newPathInput.trim());
    } else {
      await addManualProject(newPathInput.trim());
    }
    setNewPathInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] text-zinc-200 overflow-hidden">
      {/* Filter & Action Bar */}
      <div className="p-3 bg-[#121218] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[260px]">
          <div className="flex-1 max-w-xs">
            <TextInput
              size="sm"
              label="Filtrer les projets"
              isLabelHidden
              hasClear
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Filtrer 61+ projets par nom, stack, tag…"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | "all")}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:border-amber-500"
          >
            <option value="all">Tous les statuts</option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st].label}
              </option>
            ))}
          </select>

          <select
            value={stackFilter}
            onChange={(e) => setStackFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:border-amber-500 font-mono"
          >
            <option value="all">Toutes les stacks</option>
            {availableStacks.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {filteredProjects.length} / {projects.length} projets
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<FolderPlus className="w-3.5 h-3.5 text-amber-400" />}
            label="Dossiers & Ajout"
            onClick={() => setShowRootsManager(!showRootsManager)}
          />

          <SegmentedControl
            size="sm"
            label="Mode d'affichage des projets"
            value={projectViewMode}
            onChange={(val) => setProjectViewMode(val as "table" | "kanban")}
          >
            <SegmentedControlItem
              value="table"
              label="Table"
              icon={<Table2 className="w-3.5 h-3.5" />}
            />
            <SegmentedControlItem
              value="kanban"
              label="Kanban"
              icon={<Kanban className="w-3.5 h-3.5" />}
            />
          </SegmentedControl>
        </div>
      </div>

      {/* Collapsible Scan Roots & Manual Project Bar */}
      {showRootsManager && (
        <div className="p-3 bg-zinc-900/90 border-b border-zinc-800 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-400 font-semibold uppercase text-[10px]">
              Racines scannées :
            </span>
            {scanRoots.map((root) => (
              <span
                key={root}
                className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 font-mono text-[11px]"
              >
                <span>{root}</span>
                <button
                  onClick={() => removeScanRoot(root)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 max-w-md">
              <TextInput
                size="sm"
                label="Chemin absolu"
                isLabelHidden
                value={newPathInput}
                onChange={(val) => setNewPathInput(val)}
                placeholder="Chemin absolu (ex: C:\Users\elmas\Desktop\AutreDossier)"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="w-3.5 h-3.5" />}
              label="Épingler ce projet"
              onClick={() => handleAddPath(false)}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<ListFilter className="w-3.5 h-3.5" />}
              label="Ajouter comme racine de scan"
              onClick={() => handleAddPath(true)}
            />
          </div>
        </div>
      )}

      {/* Main Content: Table or Kanban */}
      {projectViewMode === "table" ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider z-10">
              <tr>
                <th className="py-2 px-3 w-8">★</th>
                <th className="py-2 px-3">Projet</th>
                <th className="py-2 px-3">Stack</th>
                <th className="py-2 px-3">Statut</th>
                <th className="py-2 px-3 text-right">Suivi Tâches</th>
                <th className="py-2 px-3 text-right">Modifié</th>
                <th className="py-2 px-3 text-right">Actions Rapides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredProjects.map((proj) => (
                <ProjectTableRow
                  key={proj.id}
                  project={proj}
                  onSelect={() => selectProject(proj.id)}
                  onTogglePin={() => updateProject(proj.id, { isPinned: !proj.isPinned })}
                  onChangeStatus={(status) => updateProject(proj.id, { status })}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-3 grid grid-cols-5 gap-3 min-w-[980px]">
          {ALL_STATUSES.map((status) => {
            const colProjects = filteredProjects.filter((p) => p.status === status);
            return (
              <div
                key={status}
                className="bg-[#121218] border border-zinc-800/90 rounded flex flex-col overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">
                    {STATUS_LABELS[status].label}
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 tabular-nums">
                    {colProjects.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => selectProject(proj.id)}
                      className="p-2.5 rounded bg-zinc-950/90 border border-zinc-800 hover:border-amber-500/60 cursor-pointer space-y-1.5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-zinc-100 truncate">
                          {proj.name}
                        </span>
                        <Badge variant="warning" label={proj.stack.toUpperCase()} />
                      </div>
                      {proj.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2">{proj.description}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 tabular-nums pt-1">
                        <span>
                          {proj.taskTotal > 0
                            ? `${proj.taskDone}/${proj.taskTotal} tâches`
                            : "Aucune tâche"}
                        </span>
                        <span>{formatRelativeTimestamp(proj.modifiedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
