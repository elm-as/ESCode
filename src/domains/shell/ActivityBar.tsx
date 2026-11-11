import React from "react";
import { Files, Search, GitBranch, Layers, LayoutDashboard, Settings } from "lucide-react";

export type SidebarTab = "explorer" | "search" | "git" | null;

interface ActivityBarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onOpenMissionControl: () => void;
  onOpenSdkModal: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMissionControl,
  onOpenSdkModal,
}) => {
  const toggleTab = (tab: "explorer" | "search" | "git") => {
    if (activeTab === tab) {
      onSelectTab(null);
    } else {
      onSelectTab(tab);
    }
  };

  return (
    <div className="w-12 bg-[#0c0c10] border-r border-zinc-800 flex flex-col justify-between items-center py-2 shrink-0 select-none z-20">
      <div className="flex flex-col items-center space-y-3 w-full">
        {/* Elmas Mission Control Cockpit */}
        <button
          onClick={onOpenMissionControl}
          title="Elmas Mission Control (Tableau de Bord)"
          className="relative p-2.5 rounded text-amber-400 hover:bg-amber-500/15 transition-colors"
        >
          <LayoutDashboard className="w-5 h-5" />
        </button>

        {/* Explorer */}
        <button
          onClick={() => toggleTab("explorer")}
          title="Explorer (Files)"
          className={`relative p-2.5 rounded transition-colors ${
            activeTab === "explorer"
              ? "text-amber-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {activeTab === "explorer" && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-amber-400" />
          )}
          <Files className="w-5 h-5" />
        </button>

        {/* Search */}
        <button
          onClick={() => toggleTab("search")}
          title="Search in Files"
          className={`relative p-2.5 rounded transition-colors ${
            activeTab === "search"
              ? "text-amber-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {activeTab === "search" && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-amber-400" />
          )}
          <Search className="w-5 h-5" />
        </button>

        {/* Source Control */}
        <button
          onClick={() => toggleTab("git")}
          title="Source Control"
          className={`relative p-2.5 rounded transition-colors ${
            activeTab === "git"
              ? "text-amber-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {activeTab === "git" && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-amber-400" />
          )}
          <GitBranch className="w-5 h-5" />
        </button>

        {/* SDK Manager */}
        <button
          onClick={onOpenSdkModal}
          title="SDK & Toolchain Manager"
          className="p-2.5 text-zinc-500 hover:text-amber-400 rounded transition-colors"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* Settings at bottom */}
      <div className="flex flex-col items-center w-full">
        <button
          onClick={onOpenSdkModal}
          title="Settings & Environment"
          className="p-2.5 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
