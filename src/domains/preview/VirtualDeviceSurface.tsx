import React, { useState, useEffect, useRef } from "react";
import { useDeviceStore } from "./device-store";
import { useTerminalStore } from "../terminal/terminal-store";
import { useDiagnosticsStore } from "../diagnostics/diagnostics-store";
import { DeviceToolbar } from "./DeviceToolbar";
import {
  RefreshCw,
  Wifi,
  BatteryMedium,
  Smartphone,
  AlertCircle,
  Play,
} from "lucide-react";

interface VirtualDeviceSurfaceProps {
  onStartProject?: () => void;
  onStopProject?: () => void;
}

export const VirtualDeviceSurface: React.FC<VirtualDeviceSurfaceProps> = ({
  onStartProject,
  onStopProject,
}) => {
  const {
    profiles,
    activeProfileId,
    orientation,
    previewMode,
    zoom,
    previewUrl,
    runtimeStatus,
    runtimeError,
    reloadKey,
  } = useDeviceStore();

  const { appendLog } = useTerminalStore();
  const { addDiagnostic } = useDiagnosticsStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentTime, setCurrentTime] = useState("09:41");
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);

  // Bi-directional bridge listening for forwarded console & errors from preview
  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object" || !event.data.__elmas_bridge) {
        return;
      }
      const { type, level, message, stack, line, file } = event.data;
      if (type === "console" && message) {
        appendLog("preview-bridge", level === "error" ? "stderr" : "stdout", message);
      }
      if (type === "error" && message) {
        addDiagnostic({
          framework: "Preview Runtime",
          severity: "error",
          message,
          stack,
          line,
          filePath: file,
        });
      }
    };
    window.addEventListener("message", handleBridgeMessage);
    return () => window.removeEventListener("message", handleBridgeMessage);
  }, [appendLog, addDiagnostic]);

  // Update mobile status bar clock every 30 seconds
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const isPortrait = orientation === "portrait";
  const deviceWidth = isPortrait ? activeProfile.width : activeProfile.height;
  const deviceHeight = isPortrait ? activeProfile.height : activeProfile.width;

  const handleCaptureScreenshot = () => {
    alert(`Screenshot of ${activeProfile.name} captured.`);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-925 select-none overflow-hidden">
      {/* Device Toolbar */}
      <DeviceToolbar
        onStartProject={onStartProject}
        onStopProject={onStopProject}
        onScreenshot={handleCaptureScreenshot}
      />

      {/* Mode Status Pill */}
      <div className="px-3 py-1 bg-zinc-950 border-b border-zinc-850 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              runtimeStatus === "running"
                ? "bg-emerald-500 animate-pulse"
                : runtimeStatus === "starting"
                ? "bg-amber-400 animate-spin"
                : runtimeStatus === "error"
                ? "bg-red-500"
                : "bg-zinc-600"
            }`}
          />
          <span className="text-zinc-400">
            {runtimeStatus === "running"
              ? `Connected (${previewMode.toUpperCase()})`
              : runtimeStatus === "starting"
              ? "Starting Server..."
              : runtimeStatus === "error"
              ? "Server Error"
              : "Preview Standby"}
          </span>
        </div>
        <div className="text-zinc-500 tabular-nums">
          {deviceWidth} × {deviceHeight} @ {activeProfile.dpi}x
        </div>
      </div>

      {/* Device Viewport Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-zinc-950/80">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            width: `${deviceWidth}px`,
            height: `${deviceHeight}px`,
          }}
          className="relative transition-all duration-200 shrink-0 shadow-2xl rounded-[38px] bg-black border-[10px] border-zinc-800 flex flex-col overflow-hidden ring-1 ring-zinc-700/50"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTouchPos({
              x: (e.clientX - rect.left) / zoom,
              y: (e.clientY - rect.top) / zoom,
            });
          }}
          onMouseLeave={() => setTouchPos(null)}
        >
          {/* Hardware Speaker Slit & Dynamic Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-40 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-1 bg-zinc-800 rounded-full" />
            <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full ml-2 border border-zinc-700/40" />
          </div>

          {/* Status Bar Simulation */}
          <div className="h-7 w-full bg-black/90 text-white flex items-center justify-between px-6 pt-1 text-[11px] font-semibold select-none z-30 shrink-0">
            <span className="tabular-nums tracking-tight">{currentTime}</span>
            <div className="flex items-center space-x-1.5 opacity-90">
              <span className="text-[10px] font-mono font-normal">5G</span>
              <Wifi className="w-3 h-3" />
              <BatteryMedium className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Screen Content Surface */}
          <div className="flex-1 w-full bg-zinc-900 relative overflow-hidden flex flex-col">
            {runtimeStatus === "running" && previewUrl ? (
              <iframe
                key={reloadKey}
                ref={iframeRef}
                src={previewUrl}
                title="Mobile Live Preview"
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            ) : runtimeStatus === "starting" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mb-3" />
                <p className="text-xs font-medium text-zinc-300 mb-1">
                  Launching {previewMode === "fast" ? "Fast Web Preview" : "Native Runtime"}...
                </p>
                <p className="text-[11px] text-zinc-500">
                  Allocating port and binding development server.
                </p>
              </div>
            ) : runtimeStatus === "error" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-red-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs font-semibold mb-1">Preview Launch Failed</p>
                <p className="text-[11px] text-zinc-400 mb-3 max-w-[260px] font-mono">
                  {runtimeError || "Unknown error occurred"}
                </p>
                <button
                  onClick={onStartProject}
                  className="px-3 py-1 bg-red-950 border border-red-700 rounded text-xs text-red-200 hover:bg-red-900 transition-colors"
                >
                  Retry Run
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                <Smartphone className="w-10 h-10 mb-2 text-zinc-600 opacity-50" />
                <p className="text-xs font-medium text-zinc-400 mb-1">Mobile Preview Ready</p>
                <p className="text-[11px] text-zinc-500 mb-3 max-w-[240px]">
                  Click <span className="text-sky-400 font-mono">Run</span> to start the live development preview in {previewMode.toUpperCase()} mode.
                </p>
                <button
                  onClick={onStartProject}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-sky-500 text-zinc-950 font-medium rounded text-xs hover:bg-sky-400 transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Preview</span>
                </button>
              </div>
            )}

            {/* Simulated Touch Reticle */}
            {touchPos && runtimeStatus === "running" && (
              <div
                style={{
                  left: `${touchPos.x - 12}px`,
                  top: `${touchPos.y - 12}px`,
                }}
                className="pointer-events-none absolute w-6 h-6 rounded-full border border-sky-400/80 bg-sky-400/20 z-50 transition-transform duration-75"
              />
            )}
          </div>

          {/* Bottom Navigation Gesture Bar */}
          <div className="h-5 w-full bg-black flex items-center justify-center select-none z-30 shrink-0">
            <div className="w-28 h-1 bg-zinc-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
