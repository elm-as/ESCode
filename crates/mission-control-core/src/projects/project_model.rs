use serde::{Deserialize, Serialize};

/// Cycle de vie métier d'un projet. Valeur par défaut `idea` : un dossier découvert
/// n'est pas encore un engagement tant que l'utilisateur ne l'a pas qualifié.
pub const PROJECT_STATUSES: &[&str] = &["idea", "active", "paused", "production", "archived"];

pub fn is_valid_status(status: &str) -> bool {
    PROJECT_STATUSES.contains(&status)
}

/// Vue condensée d'un projet pour le catalogue, le Kanban et l'accueil.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub path: String,
    pub name: String,
    pub stack: String,
    pub ui_framework: String,
    pub status: String,
    pub priority: i64,
    pub is_pinned: bool,
    pub is_ignored: bool,
    pub is_manual: bool,
    pub is_on_disk: bool,
    pub has_git: bool,
    pub description: String,
    pub repo_url: String,
    pub prod_url: String,
    pub modified_at: i64,
    pub tags: Vec<String>,
    pub task_total: i64,
    pub task_done: i64,
}

/// Fiche complète d'un projet (tiroir de détail).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
    pub summary: ProjectSummary,
    pub notes_md: String,
    pub netlify_site_id: String,
    pub tasks: Vec<ProjectTask>,
    pub milestones: Vec<ProjectMilestone>,
    pub commands: Vec<ProjectCommand>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTask {
    pub id: i64,
    pub title: String,
    pub is_done: bool,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMilestone {
    pub id: i64,
    pub title: String,
    pub due_date: Option<i64>,
    pub reached_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCommand {
    pub id: i64,
    pub label: String,
    pub command_line: String,
}

/// Modification partielle d'un projet : seuls les champs présents sont écrits.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectPatch {
    pub status: Option<String>,
    pub priority: Option<i64>,
    pub is_pinned: Option<bool>,
    pub is_ignored: Option<bool>,
    pub description: Option<String>,
    pub notes_md: Option<String>,
    pub repo_url: Option<String>,
    pub prod_url: Option<String>,
    pub netlify_site_id: Option<String>,
}

