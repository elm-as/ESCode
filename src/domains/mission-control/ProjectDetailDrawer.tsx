import React, { useEffect, useState } from "react";
import {
  CheckSquare,
  Flag,
  FolderOpen,
  Plus,
  Save,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Drawer } from "@astryxdesign/core/Drawer";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useMissionControlStore } from "./mission-control-store";
import { ProjectStatus } from "./types";
import { triggerHostAction } from "./transport";

export const ProjectDetailDrawer: React.FC = () => {
  const {
    selectedProject,
    selectProject,
    updateProject,
    setProjectTags,
    addTask,
    toggleTask,
    deleteTask,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
  } = useMissionControlStore();

  const [description, setDescription] = useState("");
  const [notesMd, setNotesMd] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [prodUrl, setProdUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");

  useEffect(() => {
    if (!selectedProject) return;
    setDescription(selectedProject.summary.description);
    setNotesMd(selectedProject.notesMd);
    setRepoUrl(selectedProject.summary.repoUrl);
    setProdUrl(selectedProject.summary.prodUrl);
    setTagsInput(selectedProject.summary.tags.join(", "));
  }, [selectedProject]);

  if (!selectedProject) return null;
  const { summary, tasks, milestones } = selectedProject;

  const handleSaveMeta = async () => {
    await updateProject(summary.id, { description, notesMd, repoUrl, prodUrl });
    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await setProjectTags(summary.id, parsedTags);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask(summary.id, newTaskTitle.trim());
    setNewTaskTitle("");
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    await addMilestone(summary.id, newMilestoneTitle.trim());
    setNewMilestoneTitle("");
  };

  return (
    <Drawer
      isOpen={!!selectedProject}
      onOpenChange={(open) => {
        if (!open) selectProject(null);
      }}
      label={`Fiche projet ${summary.name}`}
      width={512}
      purpose="form"
    >
      <div className="h-full bg-[#121218] flex flex-col text-xs text-zinc-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#0c0c10]">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-zinc-100">{summary.name}</h3>
              <Badge variant="warning" label={summary.stack.toUpperCase()} />
            </div>
            <p className="text-[11px] font-mono text-zinc-500 truncate max-w-sm">{summary.path}</p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button
              size="sm"
              variant="primary"
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              label="Ouvrir dans ESCode"
              onClick={() => triggerHostAction("openProject", { path: summary.path })}
            />
            <IconButton
              size="sm"
              variant="ghost"
              label="Fermer la fiche"
              icon={<X className="w-4 h-4" />}
              onClick={() => selectProject(null)}
            />
          </div>
        </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
              Statut du projet
            </label>
            <select
              value={summary.status}
              onChange={(e) =>
                updateProject(summary.id, { status: e.target.value as ProjectStatus })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 outline-none focus:border-amber-500"
            >
              <option value="idea">Idée / Prototype</option>
              <option value="active">En cours (Actif)</option>
              <option value="production">En Production</option>
              <option value="paused">En pause</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
              Priorité (0–5)
            </label>
            <input
              type="number"
              min={0}
              max={5}
              value={summary.priority}
              onChange={(e) =>
                updateProject(summary.id, { priority: Number(e.target.value) || 0 })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 font-mono tabular-nums text-zinc-200 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Tasks Checklist */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400">
              Tâches & Roadmap ({summary.taskDone}/{summary.taskTotal})
            </span>
          </div>
          <div className="flex space-x-1.5">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              placeholder="Ajouter une tâche à ce projet…"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-amber-500"
            />
            <button
              onClick={handleAddTask}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-zinc-800/70 border border-zinc-800 rounded bg-zinc-950/60 max-h-44 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-2.5 text-zinc-500">Aucune tâche enregistrée.</div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className="px-2.5 py-1.5 flex items-center justify-between hover:bg-zinc-900/60"
                >
                  <button
                    onClick={() => toggleTask(t.id)}
                    className="flex items-center space-x-2 text-left flex-1"
                  >
                    {t.isDone ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    )}
                    <span className={t.isDone ? "line-through text-zinc-500" : "text-zinc-200"}>
                      {t.title}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteTask(t.id)}
                    className="text-zinc-600 hover:text-red-400 p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Milestones */}
        <section className="space-y-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-300 flex items-center space-x-1.5">
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span>Jalons ({milestones.length})</span>
          </span>
          <div className="flex space-x-1.5">
            <input
              type="text"
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
              placeholder="Ajouter un jalon (ex: Release v1.0)…"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-amber-500"
            />
            <button
              onClick={handleAddMilestone}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-zinc-800/70 border border-zinc-800 rounded bg-zinc-950/60">
            {milestones.map((m) => (
              <div key={m.id} className="px-2.5 py-1.5 flex items-center justify-between">
                <button
                  onClick={() => toggleMilestone(m.id)}
                  className="flex items-center space-x-2 text-left flex-1"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      m.reachedAt ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <span className={m.reachedAt ? "line-through text-zinc-500" : "text-zinc-200"}>
                    {m.title}
                  </span>
                </button>
                <button
                  onClick={() => deleteMilestone(m.id)}
                  className="text-zinc-600 hover:text-red-400 p-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Description, Tags, Links & Notes */}
        <section className="space-y-2.5 pt-2 border-t border-zinc-800">
          <div>
            <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
              Description courte
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectif métier du projet…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1 flex items-center space-x-1">
              <Tag className="w-3 h-3" />
              <span>Tags (séparés par des virgules)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="mobile, ia, saas, client…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-zinc-200 outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
                URL Dépôt Git
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
                URL Production
              </label>
              <input
                type="text"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-zinc-400 font-semibold mb-1">
              Notes d'architecture & Mémo (Markdown)
            </label>
            <textarea
              rows={5}
              value={notesMd}
              onChange={(e) => setNotesMd(e.target.value)}
              placeholder="Décisions techniques, commandes spécifiques, identifiants de test…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 font-mono text-zinc-200 outline-none focus:border-amber-500"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            icon={<Save className="w-3.5 h-3.5" />}
            label="Enregistrer la fiche projet"
            onClick={handleSaveMeta}
          />
        </section>
      </div>
      </div>
    </Drawer>
  );
};

