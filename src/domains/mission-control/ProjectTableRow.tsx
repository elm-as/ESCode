import React from "react";
import { FolderOpen, Pin, Play, Terminal } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { ProjectStatus, ProjectSummary } from "./types";
import { formatRelativeTimestamp, triggerHostAction } from "./transport";

export const STATUS_LABELS: Record<ProjectStatus, { label: string; badgeClass: string }> = {
  idea: { label: "Idée / Proto", badgeClass: "bg-zinc-800 text-zinc-300 border-zinc-700" },
  active: { label: "En cours", badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  production: {
    label: "Production",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  paused: { label: "En pause", badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  archived: { label: "Archivé", badgeClass: "bg-zinc-900 text-zinc-500 border-zinc-800" },
};

export const ALL_STATUSES: ProjectStatus[] = [
  "idea",
  "active",
  "production",
  "paused",
  "archived",
];

interface RowProps {
  project: ProjectSummary;
  onSelect: () => void;
  onTogglePin: () => void;
  onChangeStatus: (status: ProjectStatus) => void;
}

export const ProjectTableRow: React.FC<RowProps> = ({
  project,
  onSelect,
  onTogglePin,
  onChangeStatus,
}) => {
  const pct =
    project.taskTotal > 0 ? Math.round((project.taskDone / project.taskTotal) * 100) : 0;

  return (
    <tr className="hover:bg-zinc-900/75 transition-colors group">
      <td className="py-2 px-3">
        <button
          onClick={onTogglePin}
          className={project.isPinned ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>
      </td>
      <td onClick={onSelect} className="py-2 px-3 cursor-pointer">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
            {project.name}
          </span>
          {project.hasGit && <Badge variant="neutral" label="GIT" />}
          {project.tags.map((t) => (
            <Badge key={t} variant="warning" label={`#${t}`} />
          ))}
        </div>
        <div className="text-[11px] text-zinc-500 font-mono truncate max-w-md">
          {project.description || project.path}
        </div>
      </td>
      <td className="py-2 px-3">
        <Badge variant="warning" label={project.stack.toUpperCase()} />
      </td>
      <td className="py-2 px-3">
        <select
          value={project.status}
          onChange={(e) => onChangeStatus(e.target.value as ProjectStatus)}
          className={`text-[11px] font-medium px-2 py-0.5 rounded border outline-none cursor-pointer ${
            STATUS_LABELS[project.status].badgeClass
          }`}
        >
          {ALL_STATUSES.map((st) => (
            <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
              {STATUS_LABELS[st].label}
            </option>
          ))}
        </select>
      </td>
      <td onClick={onSelect} className="py-2 px-3 text-right font-mono tabular-nums cursor-pointer">
        {project.taskTotal > 0 ? (
          <div className="inline-flex items-center space-x-2">
            <div className="w-20">
              <ProgressBar
                label="Avancement des tâches"
                isLabelHidden
                value={pct}
                max={100}
                variant="accent"
              />
            </div>
            <span className="text-zinc-300 text-[11px]">
              {project.taskDone}/{project.taskTotal}
            </span>
          </div>
        ) : (
          <span className="text-zinc-600 text-[11px]">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
        {formatRelativeTimestamp(project.modifiedAt)}
      </td>
      <td className="py-2 px-3 text-right">
        <div className="inline-flex items-center space-x-1">
          <Button
            size="sm"
            variant="secondary"
            icon={<FolderOpen className="w-3 h-3" />}
            label="Ouvrir"
            onClick={() => triggerHostAction("openProject", { path: project.path })}
          />
          <IconButton
            size="sm"
            variant="ghost"
            label="Terminal"
            tooltip="Ouvrir un terminal"
            icon={<Terminal className="w-3.5 h-3.5" />}
            onClick={() => triggerHostAction("openTerminal", { path: project.path })}
          />
          <IconButton
            size="sm"
            variant="primary"
            label="Aperçu Mobile"
            tooltip="Aperçu Mobile"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={() => triggerHostAction("runPreview", { path: project.path })}
          />
        </div>
      </td>
    </tr>
  );
};

