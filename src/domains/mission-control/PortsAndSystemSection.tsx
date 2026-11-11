import React, { useEffect } from "react";
import {
  Activity,
  Cpu,
  ExternalLink,
  HardDrive,
  Radio,
  RefreshCw,
  Skull,
  Smartphone,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Switch } from "@astryxdesign/core/Switch";
import { useMissionControlStore } from "./mission-control-store";
import { formatByteSize, triggerHostAction } from "./transport";

export const PortsAndSystemSection: React.FC<{ mode: "ports" | "system" }> = ({ mode }) => {
  const {
    ports,
    devPortsOnly,
    systemSnapshot,
    setDevPortsOnly,
    refreshPorts,
    killPortPid,
    refreshSystem,
  } = useMissionControlStore();

  useEffect(() => {
    if (mode === "ports") {
      refreshPorts();
      const timer = setInterval(refreshPorts, 4000);
      return () => clearInterval(timer);
    } else {
      refreshSystem();
      const timer = setInterval(refreshSystem, 3000);
      return () => clearInterval(timer);
    }
  }, [mode, refreshPorts, refreshSystem]);

  if (mode === "ports") {
    return (
      <div className="flex flex-col h-full bg-[#0c0c10] text-zinc-200 overflow-hidden">
        <div className="p-3 bg-[#121218] border-b border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 font-semibold text-amber-400 uppercase tracking-wider">
              <Radio className="w-4 h-4" />
              <span>Radar des Ports TCP en Écoute ({ports.length})</span>
            </div>
            <Switch
              size="sm"
              label="Ports de développement uniquement"
              value={devPortsOnly}
              onChange={(checked) => setDevPortsOnly(checked)}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Rafraîchir"
            onClick={refreshPorts}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3">Port</th>
                <th className="py-2 px-3">PID</th>
                <th className="py-2 px-3">Processus</th>
                <th className="py-2 px-3">Projet Associé</th>
                <th className="py-2 px-3">Adresse Locale</th>
                <th className="py-2 px-3 text-right">Actions Directes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {ports.map((entry) => (
                <tr key={entry.port} className="hover:bg-zinc-900/75">
                  <td className="py-2 px-3 font-bold text-amber-400 tabular-nums">
                    :{entry.port}
                  </td>
                  <td className="py-2 px-3 text-zinc-400 tabular-nums">{entry.pid}</td>
                  <td className="py-2 px-3 text-zinc-200">{entry.processName}</td>
                  <td className="py-2 px-3 font-sans">
                    {entry.projectName ? (
                      <Badge variant="warning" label={entry.projectName} />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-zinc-500 tabular-nums">
                    {entry.localAddress}:{entry.port}
                  </td>
                  <td className="py-2 px-3 text-right font-sans">
                    <div className="inline-flex items-center space-x-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<ExternalLink className="w-3 h-3" />}
                        label="Ouvrir"
                        onClick={() =>
                          triggerHostAction("openExternalUrl", {
                            url: `http://localhost:${entry.port}`,
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Smartphone className="w-3 h-3" />}
                        label="Simulateur"
                        onClick={() =>
                          triggerHostAction("openInSimulator", {
                            url: `http://localhost:${entry.port}`,
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        icon={<Skull className="w-3 h-3" />}
                        label="Kill PID"
                        onClick={() => killPortPid(entry.pid)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const ramPct = systemSnapshot
    ? Math.round((systemSnapshot.ramUsedBytes / Math.max(1, systemSnapshot.ramTotalBytes)) * 100)
    : 0;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full bg-[#0c0c10] text-zinc-200 text-xs">
      {/* Gauges Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 bg-[#121218] border border-zinc-800 rounded space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="uppercase font-semibold flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Charge CPU ({systemSnapshot?.cpuCoreCount ?? "—"} cœurs)</span>
            </span>
            <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
              {systemSnapshot?.cpuUsagePercent ?? 0}%
            </span>
          </div>
          <ProgressBar
            label="Charge CPU"
            isLabelHidden
            value={Math.min(100, systemSnapshot?.cpuUsagePercent ?? 0)}
            max={100}
            variant="accent"
          />
        </div>

        <div className="p-3 bg-[#121218] border border-zinc-800 rounded space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="uppercase font-semibold flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Mémoire RAM</span>
            </span>
            <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
              {formatByteSize(systemSnapshot?.ramUsedBytes ?? 0)} /{" "}
              {formatByteSize(systemSnapshot?.ramTotalBytes ?? 0)} ({ramPct}%)
            </span>
          </div>
          <ProgressBar
            label="Mémoire RAM"
            isLabelHidden
            value={ramPct}
            max={100}
            variant={ramPct > 85 ? "warning" : "accent"}
          />
        </div>

        <div className="p-3 bg-[#121218] border border-zinc-800 rounded space-y-1.5">
          <div className="uppercase font-semibold text-zinc-400 flex items-center space-x-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Volumes Disques</span>
          </div>
          {systemSnapshot?.disks.map((d) => (
            <div
              key={d.mountPoint}
              className="flex items-center justify-between font-mono text-[11px] tabular-nums"
            >
              <span className="text-zinc-300">{d.mountPoint}</span>
              <span className="text-emerald-400">
                {formatByteSize(d.availableBytes)} libres ({100 - Math.round(d.usedPercent)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Processes Table */}
      <div className="bg-[#121218] border border-zinc-800 rounded overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="uppercase font-semibold tracking-wider text-zinc-300">
            Top Processus Machine & Runtimes Projets
          </span>
          <button
            onClick={refreshSystem}
            className="text-[11px] text-amber-400 hover:underline flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Actualiser</span>
          </button>
        </div>
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead className="bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px]">
            <tr>
              <th className="py-1.5 px-3">PID</th>
              <th className="py-1.5 px-3">Processus</th>
              <th className="py-1.5 px-3">Projet Associé</th>
              <th className="py-1.5 px-3 text-right">CPU %</th>
              <th className="py-1.5 px-3 text-right">Mémoire RAM</th>
              <th className="py-1.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 tabular-nums">
            {systemSnapshot?.topProcesses.map((proc) => (
              <tr key={proc.pid} className="hover:bg-zinc-900/70">
                <td className="py-1.5 px-3 text-zinc-500">{proc.pid}</td>
                <td className="py-1.5 px-3 text-zinc-200">{proc.name}</td>
                <td className="py-1.5 px-3 font-sans">
                  {proc.projectName ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px]">
                      {proc.projectName}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-right text-amber-400">{proc.cpuPercent}%</td>
                <td className="py-1.5 px-3 text-right text-zinc-300">
                  {formatByteSize(proc.memoryBytes)}
                </td>
                <td className="py-1.5 px-3 text-right font-sans">
                  <button
                    onClick={() => killPortPid(proc.pid)}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-800 text-zinc-300 hover:text-white text-[11px]"
                  >
                    Terminer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

