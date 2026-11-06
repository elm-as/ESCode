import React from "react";
import { useDeviceStore } from "./device-store";
import {
  RotateCw,
  RefreshCw,
  Camera,
  Zap,
  Smartphone,
  Play,
  Square,
} from "lucide-react";

interface DeviceToolbarProps {
  onStartProject?: () => void;
  onStopProject?: () => void;
  onScreenshot?: () => void;
}

export const DeviceToolbar: React.FC<DeviceToolbarProps> = ({
  onStartProject,
  onStopProject,
  onScreenshot,
}) => {
  const {
    profiles,
    activeProfileId,
    previewMode,
    zoom,
    runtimeStatus,
    selectProfile,
    toggleOrientation,
    setPreviewMode,
    setZoom,
    reloadPreview,
  } = useDeviceStore();

  return (
    <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs gap-2 select-none">
      {/* Runtime Mode Selector */}
      <div className="flex items-center space-x-1 bg-zinc-800/80 p-0.5 rounded border border-zinc-700/60">
        <button
          onClick={() => setPreviewMode("fast")}
          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors ${
            previewMode === "fast"
              ? "bg-sky-500 text-zinc-950 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Fast Mode: Instant Web-Target preview, minimal RAM, zero Android emulator required"
        >
          <Zap className="w-3 h-3" />
          <span>FAST</span>
        </button>
        <button
          onClick={() => setPreviewMode("native")}
          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors ${
            previewMode === "native"
              ? "bg-amber-500 text-zinc-950 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Native Mode: Real framework execution with native Android ADB bridge"
        >
          <Smartphone className="w-3 h-3" />
          <span>NATIVE</span>
        </button>
      </div>

      {/* Device Profile Dropdown */}
      <div className="flex items-center space-x-1 text-zinc-300">
        <select
          value={activeProfileId}
          onChange={(e) => selectProfile(e.target.value)}
          className="bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-sky-500"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions: Orientation, Zoom, Reload, Screenshot, Run/Stop */}
      <div className="flex items-center space-x-1 text-zinc-400">
        <button
          onClick={toggleOrientation}
          title="Toggle Orientation (Portrait / Landscape)"
          className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={reloadPreview}
          title="Reload Preview Surface"
          className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onScreenshot}
          title="Capture Screenshot"
          className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Selector */}
        <select
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="bg-zinc-850 text-zinc-300 border border-zinc-750 rounded px-1.5 py-0.5 text-[11px] font-mono outline-none"
        >
          <option value="0.75">75%</option>
          <option value="0.85">85%</option>
          <option value="1.0">100%</option>
        </select>

        {/* Start / Stop Execution Toggle */}
        {runtimeStatus === "running" ? (
          <button
            onClick={onStopProject}
            title="Stop Preview Server"
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-red-950/70 border border-red-700/60 text-red-400 hover:bg-red-900/60 transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="text-[11px]">Stop</span>
          </button>
        ) : (
          <button
            onClick={onStartProject}
            title="Start Framework Preview"
            disabled={runtimeStatus === "starting"}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-sky-950/70 border border-sky-700/60 text-sky-400 hover:bg-sky-900/60 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="text-[11px] font-medium">Run</span>
          </button>
        )}
      </div>
    </div>
  );
};

