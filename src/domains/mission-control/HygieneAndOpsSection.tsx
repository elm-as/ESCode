import React, { useEffect, useState } from "react";
import {
  Eye,
  Globe,
  HardDrive,
  KeyRound,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { useMissionControlStore } from "./mission-control-store";
import { formatByteSize, triggerHostAction } from "./transport";

export const HygieneAndOpsSection: React.FC<{ mode: "disk" | "env" | "scripts" }> = ({ mode }) => {
  const {
    projects,
    artifacts,
    activeOpsProjectId,
    envReport,
    revealedEnvValues,
    projectScripts,
    outdatedPackages,
    netlifyStatus,
    refreshArtifacts,
    purgeArtifact,
    inspectProjectOps,
    revealEnvKey,
    saveEnvKey,
    checkOutdated,
  } = useMissionControlStore();

  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  useEffect(() => {
    if (mode === "disk") {
      refreshArtifacts();
    } else if (activeOpsProjectId) {
      inspectProjectOps(activeOpsProjectId);
    } else if (projects[0]) {
      inspectProjectOps(projects[0].id);
    }
  }, [mode, activeOpsProjectId, projects, refreshArtifacts, inspectProjectOps]);

  if (mode === "disk") {
    const totalBytes = artifacts.reduce((acc, a) => acc + a.sizeBytes, 0);
    return (
      <div className="flex flex-col h-full bg-[#0c0c10] text-zinc-200 overflow-hidden text-xs">
        <div className="p-3 bg-[#121218] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-semibold text-amber-400 uppercase tracking-wider">
            <HardDrive className="w-4 h-4" />
            <span>
              Nettoyeur d'Artefacts & Santé Disque — Récupérable :{" "}
              <span className="font-mono tabular-nums">{formatByteSize(totalBytes)}</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Rescanner les dossiers"
            onClick={refreshArtifacts}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Projet</th>
                <th className="py-2 px-3">Statut</th>
                <th className="py-2 px-3">Dossier d'Artefacts</th>
                <th className="py-2 px-3 text-right">Poids sur Disque</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {artifacts.map((art) => (
                <tr key={`${art.projectId}-${art.dirName}`} className="hover:bg-zinc-900/75">
                  <td className="py-2 px-3 font-semibold text-zinc-100">{art.projectName}</td>
                  <td className="py-2 px-3">
                    <Badge variant="neutral" label={art.projectStatus.toUpperCase()} />
                  </td>
                  <td className="py-2 px-3 font-mono text-amber-300">{art.dirName}/</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-400 tabular-nums">
                    {formatByteSize(art.sizeBytes)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      icon={<Trash2 className="w-3 h-3" />}
                      label="Purger"
                      onClick={() => purgeArtifact(art.projectId, art.dirName)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const currentProject = projects.find((p) => p.id === activeOpsProjectId) ?? projects[0];

  const handleSaveEnv = async () => {
    if (!currentProject || !newEnvKey.trim()) return;
    await saveEnvKey(currentProject.id, newEnvKey.trim(), newEnvValue);
    setNewEnvKey("");
    setNewEnvValue("");
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] text-zinc-200 overflow-hidden text-xs">
      {/* Project Selector Header */}
      <div className="p-3 bg-[#121218] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="uppercase font-semibold text-zinc-400 text-[11px]">Projet ciblé :</span>
          <select
            value={currentProject?.id ?? ""}
            onChange={(e) => inspectProjectOps(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-zinc-100 font-semibold outline-none focus:border-amber-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stack})
              </option>
            ))}
          </select>
        </div>

        {netlifyStatus && (
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Déploiement :{" "}
              {netlifyStatus.linked ? (
                <span className="text-emerald-400">
                  Lié ({netlifyStatus.siteUrl || netlifyStatus.siteId})
                </span>
              ) : (
                <span className="text-zinc-500">Aucun site Netlify lié</span>
              )}
            </span>
          </div>
        )}
      </div>

      {mode === "env" ? (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="bg-[#121218] border border-zinc-800 rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="uppercase font-semibold text-amber-400 flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  Coffre `.env` & Comparateur `.env.example` (
                  {envReport?.filesFound.join(", ") || "aucun fichier .env"})
                </span>
              </span>
            </div>

            {envReport && envReport.missingKeys.length > 0 && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono text-[11px]">
                Clés déclarées dans `.env.example` mais absentes de `.env` :{" "}
                <strong>{envReport.missingKeys.join(", ")}</strong>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="NOM_DE_LA_CLE (ex: DATABASE_URL)"
                className="w-56 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 font-mono text-zinc-200 outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="Valeur…"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 font-mono text-zinc-200 outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSaveEnv}
                className="px-3 py-1 rounded bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Définir dans .env</span>
              </button>
            </div>

            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px]">
                <tr>
                  <th className="py-1.5 px-3">Clé</th>
                  <th className="py-1.5 px-3">Valeur (masquée par défaut)</th>
                  <th className="py-1.5 px-3 text-right">Longueur</th>
                  <th className="py-1.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 tabular-nums">
                {envReport?.entries.map((entry) => {
                  const revealed = revealedEnvValues[entry.key];
                  return (
                    <tr key={entry.key} className="hover:bg-zinc-900/70">
                      <td className="py-1.5 px-3 text-amber-300 font-semibold">{entry.key}</td>
                      <td className="py-1.5 px-3 text-zinc-300">
                        {revealed !== undefined ? (
                          <span className="text-emerald-300 break-all">{revealed}</span>
                        ) : (
                          <span className="text-zinc-600">••••••••••••••••</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right text-zinc-400">
                        {entry.valueLength} car.
                      </td>
                      <td className="py-1.5 px-3 text-right font-sans">
                        {currentProject && (
                          <button
                            onClick={() => revealEnvKey(currentProject.id, entry.key)}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 inline-flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Révéler</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto flex-1">
          {/* Scripts Launcher */}
          <div className="bg-[#121218] border border-zinc-800 rounded p-3 space-y-2">
            <span className="uppercase font-semibold text-amber-400 block">
              Scripts & Commandes Détectés ({projectScripts.length})
            </span>
            <div className="divide-y divide-zinc-800/70">
              {projectScripts.map((sc) => (
                <div
                  key={`${sc.source}-${sc.name}`}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-zinc-100 flex items-center space-x-2">
                      <span>{sc.name}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-amber-300">
                        {sc.source}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-zinc-500">{sc.commandLine}</div>
                  </div>
                  {currentProject && (
                    <button
                      onClick={() =>
                        triggerHostAction("runCommandInTerminal", {
                          path: currentProject.path,
                          command: sc.commandLine.split("  #")[0],
                        })
                      }
                      className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 flex items-center space-x-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Exécuter</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Outdated Dependencies */}
          <div className="bg-[#121218] border border-zinc-800 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="uppercase font-semibold text-zinc-300 flex items-center space-x-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Audit des Dépendances</span>
              </span>
              {currentProject && (
                <button
                  onClick={() => checkOutdated(currentProject.id)}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 font-medium"
                >
                  Vérifier les mises à jour
                </button>
              )}
            </div>
            {outdatedPackages.length === 0 ? (
              <div className="p-3 text-zinc-500">
                Clique sur « Vérifier les mises à jour » pour inspecter les paquets obsolètes.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs tabular-nums">
                <thead className="text-zinc-400 border-b border-zinc-800 text-[10px] uppercase">
                  <tr>
                    <th className="py-1">Paquet</th>
                    <th className="py-1 text-right">Actuel</th>
                    <th className="py-1 text-right">Dernière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {outdatedPackages.map((pkg) => (
                    <tr key={pkg.name}>
                      <td className="py-1.5 text-zinc-200">{pkg.name}</td>
                      <td className="py-1.5 text-right text-amber-400">{pkg.current}</td>
                      <td className="py-1.5 text-right text-emerald-400">{pkg.latest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

