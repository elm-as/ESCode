import React, { useEffect } from "react";
import { useSdkStore } from "./sdk-store";
import { X, CheckCircle2, XCircle, RefreshCw, Layers } from "lucide-react";

export const SdkManagerModal: React.FC = () => {
  const { status, isScanning, isOpenModal, scanSdk, setOpenModal } = useSdkStore();

  useEffect(() => {
    if (isOpenModal && !status) {
      scanSdk();
    }
  }, [isOpenModal, status, scanSdk]);

  if (!isOpenModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-850 border-b border-zinc-750">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-zinc-100 text-sm">
              SDK & Environment Manager
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => scanSdk()}
              disabled={isScanning}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-750 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>Rescan</span>
            </button>
            <button
              onClick={() => setOpenModal(false)}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Paths and Environment Overview */}
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-2">
            <h4 className="font-medium text-zinc-300 text-[11px] uppercase tracking-wider">
              Environment Variables & SDK Paths
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-zinc-900 p-2 rounded">
                <div className="text-zinc-500">Android SDK</div>
                <div className="text-zinc-300 truncate" title={status?.android_sdk_path || "Not found"}>
                  {status?.android_sdk_path || "Not detected"}
                </div>
              </div>
              <div className="bg-zinc-900 p-2 rounded">
                <div className="text-zinc-500">Flutter SDK</div>
                <div className="text-zinc-300 truncate" title={status?.flutter_sdk_path || "Not found"}>
                  {status?.flutter_sdk_path || "Not detected"}
                </div>
              </div>
            </div>
          </div>

          {/* Tools List */}
          <div className="space-y-2">
            <h4 className="font-medium text-zinc-300 text-[11px] uppercase tracking-wider">
              Installed Toolchain
            </h4>
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded bg-zinc-950 overflow-hidden">
              {status?.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-3 flex items-start justify-between space-x-3 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="flex items-start space-x-2.5">
                    {tool.installed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium text-zinc-200 flex items-center space-x-2">
                        <span>{tool.name}</span>
                        {tool.version && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-sky-400 rounded">
                            {tool.version}
                          </span>
                        )}
                      </div>
                      {tool.path && (
                        <div className="text-[11px] font-mono text-zinc-500 truncate max-w-md">
                          {tool.path}
                        </div>
                      )}
                      <div className="flex items-center space-x-1.5 mt-1">
                        <span className="text-[10px] text-zinc-500">Required for:</span>
                        {tool.required_for.map((req) => (
                          <span
                            key={req}
                            className="text-[9px] px-1 py-0.2 bg-zinc-850 text-zinc-400 rounded border border-zinc-800"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        tool.installed
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : "bg-zinc-850 text-zinc-500 border border-zinc-800"
                      }`}
                    >
                      {tool.installed ? "Ready" : "Missing"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-zinc-850 border-t border-zinc-750 flex items-center justify-between text-zinc-400 text-[11px]">
          <span>Fast Preview works immediately without full Android SDK installation.</span>
          <button
            onClick={() => setOpenModal(false)}
            className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-650 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

