import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Switch } from "@astryxdesign/core/Switch";
import { useMissionControlStore } from "./mission-control-store";
import { triggerHostAction } from "./transport";

export const GitAndGithubSection: React.FC = () => {
  const {
    gitFleet,
    githubPulse,
    refreshGitFleet,
    runGitAction,
    fetchAllGit,
    loadGithubPulse,
  } = useMissionControlStore();

  const [dirtyOnly, setDirtyOnly] = useState(false);
  const [commitMessages, setCommitMessages] = useState<Record<string, string>>({});
  const [busyRepoId, setBusyRepoId] = useState<string | null>(null);

  useEffect(() => {
    refreshGitFleet();
    loadGithubPulse();
  }, [refreshGitFleet, loadGithubPulse]);

  const displayedRepos = dirtyOnly ? gitFleet.filter((r) => r.isDirty) : gitFleet;

  const handleAction = async (projectId: string, action: string, message?: string) => {
    setBusyRepoId(projectId);
    await runGitAction(projectId, action, message);
    if (action === "commit") {
      setCommitMessages((prev) => ({ ...prev, [projectId]: "" }));
    }
    setBusyRepoId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] text-zinc-200 overflow-hidden text-xs">
      {/* Top Toolbar */}
      <div className="p-3 bg-[#121218] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 font-semibold text-amber-400 uppercase tracking-wider">
            <GitBranch className="w-4 h-4" />
            <span>Tour de Contrôle Git Multi-Dépôts ({displayedRepos.length})</span>
          </div>
          <Switch
            size="sm"
            label="Dépôts avec modifications uniquement"
            value={dirtyOnly}
            onChange={(checked) => setDirtyOnly(checked)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="primary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Fetch All Repos"
            onClick={fetchAllGit}
          />
          <Button
            size="sm"
            variant="secondary"
            label="Actualiser"
            onClick={refreshGitFleet}
          />
        </div>
      </div>

      {/* GitHub CLI Strip */}
      {githubPulse && (
        <div className="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-zinc-300">GitHub CLI (`gh`) :</span>
            {githubPulse.authenticated ? (
              <span className="text-emerald-400 font-mono">
                Connecté ({githubPulse.account}) • {githubPulse.openPrs.length} PR ouvertes •{" "}
                {githubPulse.openIssues.length} Issues ouvertes
              </span>
            ) : (
              <span className="text-zinc-500">
                Non authentifié (`gh auth login` pour activer le suivi PR/CI)
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto">
            {githubPulse.openPrs.slice(0, 3).map((pr) => (
              <button
                key={`${pr.repoName}-${pr.number}`}
                onClick={() => triggerHostAction("openExternalUrl", { url: pr.url })}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono flex items-center space-x-1"
              >
                <span className="text-amber-400">{pr.repoName}</span>
                <span>#{pr.number}</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Repo Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#14141c] text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider z-10">
            <tr>
              <th className="py-2 px-3">Dépôt</th>
              <th className="py-2 px-3">Branche</th>
              <th className="py-2 px-3 text-right">État Working Tree</th>
              <th className="py-2 px-3 text-right">Sync</th>
              <th className="py-2 px-3">Dernier Commit</th>
              <th className="py-2 px-3">Commit Éclair & Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {displayedRepos.map((repo) => {
              const msg = commitMessages[repo.projectId] ?? "";
              const isBusy = busyRepoId === repo.projectId;
              return (
                <tr key={repo.projectId} className="hover:bg-zinc-900/75">
                  <td className="py-2 px-3">
                    <div className="font-semibold text-zinc-100 flex items-center space-x-1.5">
                      <span>{repo.projectName}</span>
                      <button
                        onClick={() => triggerHostAction("openProject", { path: repo.path })}
                        title="Ouvrir dans ESCode"
                        className="text-zinc-500 hover:text-amber-400"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-amber-300">
                    {repo.branch}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px]">
                    {repo.isDirty ? (
                      <div className="inline-flex items-center space-x-1.5">
                        {repo.stagedCount > 0 && (
                          <Badge variant="success" label={`+${repo.stagedCount} staged`} />
                        )}
                        {repo.modifiedCount > 0 && (
                          <Badge variant="warning" label={`~${repo.modifiedCount} mod`} />
                        )}
                        {repo.untrackedCount > 0 && (
                          <Badge variant="info" label={`?${repo.untrackedCount} new`} />
                        )}
                      </div>
                    ) : (
                      <Badge variant="success" label="Clean" />
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px]">
                    <span className={repo.ahead > 0 ? "text-amber-400 mr-2" : "text-zinc-600 mr-2"}>
                      ↑{repo.ahead}
                    </span>
                    <span className={repo.behind > 0 ? "text-red-400" : "text-zinc-600"}>
                      ↓{repo.behind}
                    </span>
                  </td>
                  <td className="py-2 px-3 max-w-xs">
                    <div className="truncate text-zinc-300 text-[11px]">
                      <span className="font-mono text-amber-400 mr-1.5">
                        {repo.lastCommitHash}
                      </span>
                      <span>{repo.lastCommitMessage}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                      {repo.lastCommitRelative}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1.5">
                      {repo.isDirty && (
                        <>
                          <input
                            type="text"
                            value={msg}
                            onChange={(e) =>
                              setCommitMessages((prev) => ({
                                ...prev,
                                [repo.projectId]: e.target.value,
                              }))
                            }
                            placeholder="Message de commit…"
                            className="w-40 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-amber-500"
                          />
                          <button
                            disabled={isBusy || !msg.trim()}
                            onClick={() => handleAction(repo.projectId, "commit", msg)}
                            className="px-2 py-1 rounded bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 disabled:opacity-40 flex items-center space-x-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Commit</span>
                          </button>
                        </>
                      )}
                      <button
                        disabled={isBusy}
                        onClick={() => handleAction(repo.projectId, "pull")}
                        title="git pull --rebase --autostash"
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center space-x-0.5"
                      >
                        <ArrowDown className="w-3 h-3" />
                        <span>Pull</span>
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => handleAction(repo.projectId, "push")}
                        title="git push"
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center space-x-0.5"
                      >
                        <ArrowUp className="w-3 h-3" />
                        <span>Push</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

