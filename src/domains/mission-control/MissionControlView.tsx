import React, { useEffect } from "react";
import {
  Activity,
  Command,
  FolderKanban,
  GitBranch,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  PlaySquare,
  Radio,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Kbd } from "@astryxdesign/core/Kbd";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { useMissionControlStore } from "./mission-control-store";
import { MissionModuleId } from "./types";
import { formatByteSize } from "./transport";
import { OverviewSection } from "./OverviewSection";
import { ProjectsCatalogSection } from "./ProjectsCatalogSection";
import { PortsAndSystemSection } from "./PortsAndSystemSection";
import { GitAndGithubSection } from "./GitAndGithubSection";
import { HygieneAndOpsSection } from "./HygieneAndOpsSection";
import { ProjectDetailDrawer } from "./ProjectDetailDrawer";
import { CommandPaletteModal } from "./CommandPaletteModal";

const NAV_MODULES: { id: MissionModuleId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Accueil Cockpit", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "projects", label: "Projets & Kanban", icon: <FolderKanban className="w-4 h-4" /> },
  { id: "ports", label: "Radar des Ports", icon: <Radio className="w-4 h-4" /> },
  { id: "git", label: "Git & GitHub", icon: <GitBranch className="w-4 h-4" /> },
  { id: "system", label: "Système & CPU", icon: <Activity className="w-4 h-4" /> },
  { id: "disk", label: "Disque & Purge", icon: <HardDrive className="w-4 h-4" /> },
  { id: "env", label: "Coffre .env", icon: <KeyRound className="w-4 h-4" /> },
  { id: "scripts", label: "Scripts & Deps", icon: <PlaySquare className="w-4 h-4" /> },
];

export const MissionControlView: React.FC = () => {
  const {
    activeModule,
    overview,
    projects,
    ports,
    gitFleet,
    errorBanner,
    setActiveModule,
    setPaletteOpen,
    clearError,
    loadInitialCockpit,
  } = useMissionControlStore();

  useEffect(() => {
    loadInitialCockpit();
  }, [loadInitialCockpit]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPaletteOpen]);

  const dirtyCount = gitFleet.filter((r) => r.isDirty).length || overview?.dirtyGitRepos || 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0c10] text-zinc-100 select-none overflow-hidden">
      {/* 1. Top KPI Telemetry Strip */}
      <div className="h-11 bg-[#101016] border-b border-zinc-800 px-3 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-4 overflow-x-auto">
          <div className="flex items-center space-x-2 font-bold tracking-wider text-amber-400">
            <LayoutDashboard className="w-4 h-4" />
            <span>ELMAS MISSION CONTROL</span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <KpiPill
            label="Projets"
            value={String(overview?.totalProjects || projects.length)}
            accent="text-zinc-100"
            onClick={() => setActiveModule("projects")}
          />
          <KpiPill
            label="En cours"
            value={String(overview?.activeProjects ?? 0)}
            accent="text-amber-400"
            onClick={() => setActiveModule("projects")}
          />
          <KpiPill
            label="En Prod"
            value={String(overview?.productionProjects ?? 0)}
            accent="text-emerald-400"
            onClick={() => setActiveModule("projects")}
          />
          <KpiPill
            label="Ports Dev"
            value={String(ports.length)}
            accent="text-sky-400"
            onClick={() => setActiveModule("ports")}
          />
          <KpiPill
            label="Git Modifiés"
            value={String(dirtyCount)}
            accent={dirtyCount > 0 ? "text-amber-400" : "text-emerald-400"}
            onClick={() => setActiveModule("git")}
          />
          <KpiPill
            label="Purgeable"
            value={formatByteSize(overview?.reclaimableBytes ?? 0)}
            accent="text-amber-300"
            onClick={() => setActiveModule("disk")}
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            icon={<Command className="w-3.5 h-3.5 text-amber-400" />}
            label="Palette"
            onClick={() => setPaletteOpen(true)}
          />
          <Kbd keys="mod+k" />
          <IconButton
            size="sm"
            variant="ghost"
            label="Synchroniser tout le cockpit"
            tooltip="Synchroniser tout le cockpit"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadInitialCockpit}
          />
        </div>
      </div>

      {/* Optional Error Banner */}
      {errorBanner && (
        <div className="px-3 py-1.5 bg-red-950/90 border-b border-red-800 text-red-200 text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <IconButton
            size="sm"
            variant="ghost"
            label="Fermer l'alerte"
            icon={<X className="w-3.5 h-3.5" />}
            onClick={clearError}
          />
        </div>
      )}

      {/* 2. Body: Left Compact Module Rail + Active Module Surface */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <nav className="w-44 bg-[#101016] border-r border-zinc-800 p-2 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            {NAV_MODULES.map((m) => {
              const active = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={`w-full px-2.5 py-2 rounded text-xs flex items-center space-x-2.5 transition-colors ${
                    active
                      ? "bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  {m.icon}
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-[10px] font-mono text-zinc-500 space-y-1">
            <StatusDot variant="accent" isPulsing label="ELMASCORE COCKPIT" />
            <div>Astryx UI • Rust Core</div>
          </div>
        </nav>

        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {activeModule === "overview" && <OverviewSection />}
          {activeModule === "projects" && <ProjectsCatalogSection />}
          {activeModule === "ports" && <PortsAndSystemSection mode="ports" />}
          {activeModule === "system" && <PortsAndSystemSection mode="system" />}
          {activeModule === "git" && <GitAndGithubSection />}
          {activeModule === "disk" && <HygieneAndOpsSection mode="disk" />}
          {activeModule === "env" && <HygieneAndOpsSection mode="env" />}
          {activeModule === "scripts" && <HygieneAndOpsSection mode="scripts" />}
        </div>
      </div>

      <ProjectDetailDrawer />
      <CommandPaletteModal />
    </div>
  );
};

const KpiPill: React.FC<{
  label: string;
  value: string;
  accent: string;
  onClick: () => void;
}> = ({ label, value, accent, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-zinc-900 transition-colors"
  >
    <span className="text-zinc-500 text-[11px]">{label}</span>
    <span className={`font-mono font-bold text-xs tabular-nums ${accent}`}>{value}</span>
  </button>
);

