export type ProjectStatus = "idea" | "active" | "paused" | "production" | "archived";

export type MissionModuleId =
  | "overview"
  | "projects"
  | "ports"
  | "git"
  | "system"
  | "disk"
  | "env"
  | "scripts";

export interface ProjectSummary {
  id: string;
  path: string;
  name: string;
  stack: string;
  uiFramework: string;
  status: ProjectStatus;
  priority: number;
  isPinned: boolean;
  isIgnored: boolean;
  isManual: boolean;
  isOnDisk: boolean;
  hasGit: boolean;
  description: string;
  repoUrl: string;
  prodUrl: string;
  modifiedAt: number;
  tags: string[];
  taskTotal: number;
  taskDone: number;
}

export interface ProjectTask {
  id: number;
  title: string;
  isDone: boolean;
  position: number;
}

export interface ProjectMilestone {
  id: number;
  title: string;
  dueDate: number | null;
  reachedAt: number | null;
}

export interface ProjectCommand {
  id: number;
  label: string;
  commandLine: string;
}

export interface ProjectDetail {
  summary: ProjectSummary;
  notesMd: string;
  netlifySiteId: string;
  tasks: ProjectTask[];
  milestones: ProjectMilestone[];
  commands: ProjectCommand[];
}

export interface ProjectPatch {
  status?: ProjectStatus;
  priority?: number;
  isPinned?: boolean;
  isIgnored?: boolean;
  description?: string;
  notesMd?: string;
  repoUrl?: string;
  prodUrl?: string;
  netlifySiteId?: string;
}

export interface ActivePortEntry {
  port: number;
  pid: number;
  processName: string;
  localAddress: string;
  isDevPort: boolean;
  projectId: string | null;
  projectName: string | null;
}

export interface DiskTelemetry {
  name: string;
  mountPoint: string;
  availableBytes: number;
  totalBytes: number;
  usedPercent: number;
}

export interface ProcessTelemetry {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  projectName: string | null;
}

export interface SystemSnapshot {
  sampledAt: number;
  cpuUsagePercent: number;
  cpuCoreCount: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  swapUsedBytes: number;
  swapTotalBytes: number;
  disks: DiskTelemetry[];
  topProcesses: ProcessTelemetry[];
}

export interface GitRepoStatus {
  projectId: string;
  projectName: string;
  path: string;
  branch: string;
  modifiedCount: number;
  untrackedCount: number;
  stagedCount: number;
  ahead: number;
  behind: number;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitRelative: string;
  lastCommitTimestamp: number;
  isDirty: boolean;
}

export interface CommitDayBucket {
  date: string;
  count: number;
}

export interface ProjectArtifactEntry {
  projectId: string;
  projectName: string;
  projectStatus: string;
  dirName: string;
  fullPath: string;
  sizeBytes: number;
  computedAt: number;
}

export interface EnvKeyStatus {
  key: string;
  isEmpty: boolean;
  valueLength: number;
  inExample: boolean;
}

export interface EnvInspectionReport {
  projectId: string;
  filesFound: string[];
  entries: EnvKeyStatus[];
  missingKeys: string[];
}

export interface ProjectScriptItem {
  name: string;
  commandLine: string;
  source: string;
}

export interface GithubItemSummary {
  number: number;
  title: string;
  repoName: string;
  state: string;
  url: string;
}

export interface GithubRepoPulse {
  authenticated: boolean;
  account: string;
  openPrs: GithubItemSummary[];
  openIssues: GithubItemSummary[];
}

export interface OutdatedPackageItem {
  name: string;
  current: string;
  latest: string;
}

export interface NetlifySiteStatus {
  linked: boolean;
  siteId: string;
  siteName: string;
  siteUrl: string;
}

export interface ProjectTimeSummary {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  sessionCount: number;
  lastSessionAt: number;
}

export interface DashboardAlert {
  severity: "warning" | "info" | "critical";
  code: string;
  title: string;
  detail: string;
  projectId: string | null;
}

export interface OverviewSnapshot {
  totalProjects: number;
  activeProjects: number;
  productionProjects: number;
  listeningDevPorts: number;
  dirtyGitRepos: number;
  reclaimableBytes: number;
  alerts: DashboardAlert[];
  recentProjects: ProjectSummary[];
  timeSummaries: ProjectTimeSummary[];
}

