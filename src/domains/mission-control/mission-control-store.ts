import { create } from "zustand";
import { mcCall } from "./transport";
import {
  ActivePortEntry,
  CommitDayBucket,
  EnvInspectionReport,
  GithubRepoPulse,
  GitRepoStatus,
  MissionModuleId,
  NetlifySiteStatus,
  OutdatedPackageItem,
  OverviewSnapshot,
  ProjectArtifactEntry,
  ProjectDetail,
  ProjectPatch,
  ProjectScriptItem,
  ProjectStatus,
  ProjectSummary,
  SystemSnapshot,
} from "./types";

interface MissionControlState {
  activeModule: MissionModuleId;
  projects: ProjectSummary[];
  scanRoots: string[];
  selectedProject: ProjectDetail | null;
  overview: OverviewSnapshot | null;
  ports: ActivePortEntry[];
  devPortsOnly: boolean;
  systemSnapshot: SystemSnapshot | null;
  gitFleet: GitRepoStatus[];
  commitHeatmap: CommitDayBucket[];
  githubPulse: GithubRepoPulse | null;
  artifacts: ProjectArtifactEntry[];
  envReport: EnvInspectionReport | null;
  revealedEnvValues: Record<string, string>;
  projectScripts: ProjectScriptItem[];
  outdatedPackages: OutdatedPackageItem[];
  netlifyStatus: NetlifySiteStatus | null;
  activeOpsProjectId: string | null;
  searchQuery: string;
  statusFilter: ProjectStatus | "all";
  stackFilter: string;
  projectViewMode: "table" | "kanban";
  isPaletteOpen: boolean;
  isLoading: boolean;
  errorBanner: string | null;

  setActiveModule: (module: MissionModuleId) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: ProjectStatus | "all") => void;
  setStackFilter: (stack: string) => void;
  setProjectViewMode: (mode: "table" | "kanban") => void;
  setDevPortsOnly: (devOnly: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  clearError: () => void;

  loadInitialCockpit: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  selectProject: (projectId: string | null) => Promise<void>;
  updateProject: (projectId: string, patch: ProjectPatch) => Promise<void>;
  setProjectTags: (projectId: string, tags: string[]) => Promise<void>;
  addManualProject: (path: string) => Promise<void>;
  addScanRoot: (path: string) => Promise<void>;
  removeScanRoot: (path: string) => Promise<void>;

  addTask: (projectId: string, title: string) => Promise<void>;
  toggleTask: (taskId: number) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  addMilestone: (projectId: string, title: string) => Promise<void>;
  toggleMilestone: (milestoneId: number) => Promise<void>;
  deleteMilestone: (milestoneId: number) => Promise<void>;

  refreshPorts: () => Promise<void>;
  killPortPid: (pid: number) => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshGitFleet: () => Promise<void>;
  runGitAction: (projectId: string, action: string, message?: string) => Promise<void>;
  fetchAllGit: () => Promise<void>;
  loadGithubPulse: () => Promise<void>;
  refreshArtifacts: () => Promise<void>;
  purgeArtifact: (projectId: string, dirName: string) => Promise<void>;
  inspectProjectOps: (projectId: string) => Promise<void>;
  revealEnvKey: (projectId: string, key: string) => Promise<void>;
  saveEnvKey: (projectId: string, key: string, value: string) => Promise<void>;
  checkOutdated: (projectId: string) => Promise<void>;
}

export const useMissionControlStore = create<MissionControlState>((set, get) => ({
  activeModule: "overview",
  projects: [],
  scanRoots: [],
  selectedProject: null,
  overview: null,
  ports: [],
  devPortsOnly: true,
  systemSnapshot: null,
  gitFleet: [],
  commitHeatmap: [],
  githubPulse: null,
  artifacts: [],
  envReport: null,
  revealedEnvValues: {},
  projectScripts: [],
  outdatedPackages: [],
  netlifyStatus: null,
  activeOpsProjectId: null,
  searchQuery: "",
  statusFilter: "all",
  stackFilter: "all",
  projectViewMode: "table",
  isPaletteOpen: false,
  isLoading: false,
  errorBanner: null,

  setActiveModule: (activeModule) => set({ activeModule }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setStackFilter: (stackFilter) => set({ stackFilter }),
  setProjectViewMode: (projectViewMode) => set({ projectViewMode }),
  setDevPortsOnly: (devPortsOnly) => {
    set({ devPortsOnly });
    get().refreshPorts();
  },
  setPaletteOpen: (isPaletteOpen) => set({ isPaletteOpen }),
  clearError: () => set({ errorBanner: null }),

  loadInitialCockpit: async () => {
    set({ isLoading: true, errorBanner: null });
    try {
      const [projects, scanRoots, overview, ports] = await Promise.all([
        mcCall<ProjectSummary[]>("projects.list"),
        mcCall<string[]>("roots.list"),
        mcCall<OverviewSnapshot>("overview.snapshot"),
        mcCall<ActivePortEntry[]>("ports.scan", { devOnly: get().devPortsOnly }),
      ]);
      const firstId = projects[0]?.id ?? null;
      set({ projects, scanRoots, overview, ports, activeOpsProjectId: firstId, isLoading: false });
      mcCall<GitRepoStatus[]>("git.fleet").then((gitFleet) => set({ gitFleet })).catch(() => {});
      mcCall<CommitDayBucket[]>("git.heatmap").then((commitHeatmap) => set({ commitHeatmap })).catch(() => {});
    } catch (err) {
      set({ isLoading: false, errorBanner: (err as Error).message });
    }
  },

  refreshProjects: async () => {
    try {
      const [projects, scanRoots, overview] = await Promise.all([
        mcCall<ProjectSummary[]>("projects.list"),
        mcCall<string[]>("roots.list"),
        mcCall<OverviewSnapshot>("overview.snapshot"),
      ]);
      set({ projects, scanRoots, overview });
    } catch (err) {
      set({ errorBanner: (err as Error).message });
    }
  },

  selectProject: async (projectId) => {
    if (!projectId) {
      set({ selectedProject: null });
      return;
    }
    try {
      const detail = await mcCall<ProjectDetail>("projects.detail", { projectId });
      set({ selectedProject: detail });
    } catch (err) {
      set({ errorBanner: (err as Error).message });
    }
  },

  updateProject: async (projectId, patch) => {
    try {
      await mcCall("projects.update", { projectId, patch });
      await get().refreshProjects();
      if (get().selectedProject?.summary.id === projectId) {
        await get().selectProject(projectId);
      }
    } catch (err) {
      set({ errorBanner: (err as Error).message });
    }
  },

  setProjectTags: async (projectId, tags) => {
    await mcCall("projects.setTags", { projectId, tags });
    await get().refreshProjects();
    if (get().selectedProject?.summary.id === projectId) {
      await get().selectProject(projectId);
    }
  },

  addManualProject: async (path) => {
    await mcCall("projects.addManual", { path });
    await get().refreshProjects();
  },

  addScanRoot: async (path) => {
    await mcCall("roots.add", { path });
    await get().refreshProjects();
  },

  removeScanRoot: async (path) => {
    await mcCall("roots.remove", { path });
    await get().refreshProjects();
  },

  addTask: async (projectId, title) => {
    await mcCall("tasks.add", { projectId, title });
    await get().selectProject(projectId);
    await get().refreshProjects();
  },

  toggleTask: async (taskId) => {
    await mcCall("tasks.toggle", { id: taskId });
    const current = get().selectedProject?.summary.id;
    if (current) await get().selectProject(current);
    await get().refreshProjects();
  },

  deleteTask: async (taskId) => {
    await mcCall("tasks.delete", { id: taskId });
    const current = get().selectedProject?.summary.id;
    if (current) await get().selectProject(current);
    await get().refreshProjects();
  },

  addMilestone: async (projectId, title) => {
    await mcCall("milestones.add", { projectId, title, dueDate: null });
    await get().selectProject(projectId);
  },

  toggleMilestone: async (milestoneId) => {
    await mcCall("milestones.toggle", { id: milestoneId });
    const current = get().selectedProject?.summary.id;
    if (current) await get().selectProject(current);
  },

  deleteMilestone: async (milestoneId) => {
    await mcCall("milestones.delete", { id: milestoneId });
    const current = get().selectedProject?.summary.id;
    if (current) await get().selectProject(current);
  },

  refreshPorts: async () => {
    const ports = await mcCall<ActivePortEntry[]>("ports.scan", { devOnly: get().devPortsOnly });
    set({ ports });
  },

  killPortPid: async (pid) => {
    await mcCall("ports.kill", { pid });
    await get().refreshPorts();
  },

  refreshSystem: async () => {
    const systemSnapshot = await mcCall<SystemSnapshot>("system.sample");
    set({ systemSnapshot });
  },

  refreshGitFleet: async () => {
    const gitFleet = await mcCall<GitRepoStatus[]>("git.fleet");
    set({ gitFleet });
  },

  runGitAction: async (projectId, action, message) => {
    try {
      await mcCall("git.action", { projectId, action, message });
      await get().refreshGitFleet();
    } catch (err) {
      set({ errorBanner: (err as Error).message });
    }
  },

  fetchAllGit: async () => {
    await mcCall("git.fetchAll");
    await get().refreshGitFleet();
  },

  loadGithubPulse: async () => {
    const githubPulse = await mcCall<GithubRepoPulse>("github.pulse");
    set({ githubPulse });
  },

  refreshArtifacts: async () => {
    const artifacts = await mcCall<ProjectArtifactEntry[]>("disk.scan");
    set({ artifacts });
  },

  purgeArtifact: async (projectId, dirName) => {
    await mcCall("disk.purge", { projectId, dirName });
    await get().refreshArtifacts();
  },

  inspectProjectOps: async (projectId) => {
    set({ activeOpsProjectId: projectId, revealedEnvValues: {}, outdatedPackages: [] });
    const [envReport, projectScripts, netlifyStatus] = await Promise.all([
      mcCall<EnvInspectionReport>("env.inspect", { projectId }),
      mcCall<ProjectScriptItem[]>("scripts.list", { projectId }),
      mcCall<NetlifySiteStatus>("deployments.status", { projectId }),
    ]);
    set({ envReport, projectScripts, netlifyStatus });
  },

  revealEnvKey: async (projectId, key) => {
    const val = await mcCall<string>("env.reveal", { projectId, key });
    set((s) => ({ revealedEnvValues: { ...s.revealedEnvValues, [key]: val } }));
  },

  saveEnvKey: async (projectId, key, value) => {
    await mcCall("env.set", { projectId, key, value });
    await get().inspectProjectOps(projectId);
  },

  checkOutdated: async (projectId) => {
    const outdatedPackages = await mcCall<OutdatedPackageItem[]>("dependencies.outdated", { projectId });
    set({ outdatedPackages });
  },
}));

