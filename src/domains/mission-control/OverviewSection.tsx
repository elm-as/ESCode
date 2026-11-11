import React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  FolderOpen,
  GitBranch,
  Play,
  Radio,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { useMissionControlStore } from "./mission-control-store";
import { formatByteSize, formatRelativeTimestamp, triggerHostAction } from "./transport";

export const OverviewSection: React.FC = () => {
  const {
    overview,
    projects,
    ports,
    commitHeatmap,
    setActiveModule,
    selectProject,
  } = useMissionControlStore();

  const recentProjects = overview?.recentProjects ?? projects.slice(0, 8);
  const alerts = overview?.alerts ?? [];
  const timeSummaries = overview?.timeSummaries ?? [];

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full bg-[#0c0c10] text-zinc-200">
      {/* 3-Column High-Density Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Col 1 (4 cols): Actionable Alerts & Active Dev Ports */}
        <div className="lg:col-span-4 space-y-4">
          <section className="bg-[#121218] border border-zinc-800/90 rounded">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Signaux & Alertes ({alerts.length})</span>
              </div>
              <button
                onClick={() => setActiveModule("git")}
                className="text-[11px] text-zinc-400 hover:text-amber-400"
              >
                Voir Git →
              </button>
            </div>
            <div className="divide-y divide-zinc-800/70 max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500">
                  Aucune alerte critique détectée sur les dépôts et ports actifs.
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <div
                    key={`${alert.code}-${idx}`}
                    onClick={() => {
                      if (alert.projectId) selectProject(alert.projectId);
                    }}
                    className="px-3 py-2 hover:bg-zinc-900/70 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <StatusDot
                        variant={alert.severity === "warning" ? "warning" : "accent"}
                        label={alert.title}
                      />
                      <Badge variant="neutral" label={alert.code} />
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{alert.detail}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Active Dev Ports Mini-Radar */}
          <section className="bg-[#121218] border border-zinc-800/90 rounded">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Radio className="w-3.5 h-3.5" />
                <span>Ports Dev en Écoute ({ports.length})</span>
              </div>
              <button
                onClick={() => setActiveModule("ports")}
                className="text-[11px] text-zinc-400 hover:text-amber-400"
              >
                Radar complet →
              </button>
            </div>
            <div className="divide-y divide-zinc-800/70 max-h-56 overflow-y-auto font-mono text-xs">
              {ports.length === 0 ? (
                <div className="p-3 text-zinc-500 font-sans">
                  Aucun serveur de développement actif détecté.
                </div>
              ) : (
                ports.slice(0, 6).map((p) => (
                  <div
                    key={p.port}
                    className="px-3 py-1.5 flex items-center justify-between hover:bg-zinc-900/60"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-amber-400 font-semibold tabular-nums">:{p.port}</span>
                      <span className="text-zinc-300 truncate max-w-[130px]">{p.processName}</span>
                      {p.projectName && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/15 text-amber-300">
                          {p.projectName}
                        </span>
                      )}
                    </div>
                    <span className="text-zinc-500 tabular-nums text-[11px]">PID {p.pid}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Col 2 (5 cols): Recent Projects Table */}
        <div className="lg:col-span-5 bg-[#121218] border border-zinc-800/90 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Projets Récemment Modifiés</span>
            </div>
            <button
              onClick={() => setActiveModule("projects")}
              className="text-[11px] text-amber-400 hover:underline"
            >
              Catalogue ({projects.length}) →
            </button>
          </div>
          <div className="divide-y divide-zinc-800/70 flex-1 overflow-y-auto">
            {recentProjects.map((proj) => (
              <div
                key={proj.id}
                className="px-3 py-2 flex items-center justify-between hover:bg-zinc-900/70 transition-colors"
              >
                <div
                  onClick={() => selectProject(proj.id)}
                  className="min-w-0 flex-1 cursor-pointer pr-2"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {proj.name}
                    </span>
                    <Badge variant="warning" label={proj.stack.toUpperCase()} />
                    <Badge variant="neutral" label={proj.status.toUpperCase()} />
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5 tabular-nums">
                    {formatRelativeTimestamp(proj.modifiedAt)} • {proj.path}
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <IconButton
                    size="sm"
                    variant="secondary"
                    label="Ouvrir dans l'éditeur ESCode"
                    tooltip="Ouvrir dans l'éditeur ESCode"
                    icon={<FolderOpen className="w-3.5 h-3.5" />}
                    onClick={() => triggerHostAction("openProject", { path: proj.path })}
                  />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="Ouvrir un terminal"
                    tooltip="Ouvrir un terminal dans ce projet"
                    icon={<Terminal className="w-3.5 h-3.5" />}
                    onClick={() => triggerHostAction("openTerminal", { path: proj.path })}
                  />
                  <IconButton
                    size="sm"
                    variant="primary"
                    label="Lancer l'Aperçu Mobile"
                    tooltip="Lancer l'Aperçu Mobile"
                    icon={<Play className="w-3.5 h-3.5" />}
                    onClick={() => triggerHostAction("runPreview", { path: proj.path })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3 (3 cols): Time Spent & Activity Heatmap */}
        <div className="lg:col-span-3 space-y-4">
          <section className="bg-[#121218] border border-zinc-800/90 rounded">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Temps & Sessions</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Auto-track</span>
            </div>
            <div className="divide-y divide-zinc-800/70 max-h-56 overflow-y-auto">
              {timeSummaries.slice(0, 7).map((item) => (
                <div
                  key={item.projectId}
                  onClick={() => selectProject(item.projectId)}
                  className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-zinc-900/60 cursor-pointer"
                >
                  <span className="text-zinc-300 truncate max-w-[130px]">{item.projectName}</span>
                  <div className="font-mono text-[11px] tabular-nums text-right">
                    <span className="text-amber-400 font-semibold">{item.totalMinutes} min</span>
                    <span className="text-zinc-500 ml-1.5">({item.sessionCount} sess.)</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#121218] border border-zinc-800/90 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center space-x-1.5">
                <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                <span>Cadence Git (180j)</span>
              </span>
              <span className="font-mono text-[11px] text-amber-400 tabular-nums">
                {commitHeatmap.reduce((acc, b) => acc + b.count, 0)} commits
              </span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {commitHeatmap.slice(-42).map((bucket) => {
                const intensity =
                  bucket.count >= 8
                    ? "bg-amber-400"
                    : bucket.count >= 4
                    ? "bg-amber-500/75"
                    : bucket.count >= 1
                    ? "bg-amber-600/40"
                    : "bg-zinc-800";
                return (
                  <div
                    key={bucket.date}
                    title={`${bucket.date} : ${bucket.count} commit(s)`}
                    className={`w-3 h-3 rounded-xs ${intensity}`}
                  />
                );
              })}
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Artefacts récupérables :</span>
              <button
                onClick={() => setActiveModule("disk")}
                className="font-mono text-amber-400 hover:underline flex items-center tabular-nums"
              >
                <span>{formatByteSize(overview?.reclaimableBytes ?? 0)}</span>
                <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

