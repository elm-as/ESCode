use crate::command_payload::{acknowledged, parse_payload, to_response};
use crate::disk;
use crate::git::{self, GitRepoStatus};
use crate::mission_error::MissionResult;
use crate::ports::{self, ActivePortEntry};
use crate::projects::project_catalog;
use crate::projects::project_model::ProjectSummary;
use crate::storage::connection::{unix_now, MissionStore};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Seuil d'inactivité (10 minutes) au-delà duquel une session d'édition démarre un nouveau créneau.
const SESSION_GAP_SECONDS: i64 = 600;
/// Seuil (30 jours) au-delà duquel un projet marqué `active` sans modification est signalé dormant.
const DORMANT_PROJECT_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTimeSummary {
    pub project_id: String,
    pub project_name: String,
    pub total_minutes: i64,
    pub session_count: i64,
    pub last_session_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardAlert {
    pub severity: String, // "warning" | "info" | "critical"
    pub code: String,
    pub title: String,
    pub detail: String,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewSnapshot {
    pub total_projects: usize,
    pub active_projects: usize,
    pub production_projects: usize,
    pub listening_dev_ports: usize,
    pub dirty_git_repos: usize,
    pub reclaimable_bytes: u64,
    pub alerts: Vec<DashboardAlert>,
    pub recent_projects: Vec<ProjectSummary>,
    pub time_summaries: Vec<ProjectTimeSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TouchSessionInput {
    project_id: String,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "sessions.touch" => parse_payload::<TouchSessionInput>(payload)
            .and_then(|input| touch_project_session(store, &input.project_id))
            .and_then(|_| acknowledged()),
        "sessions.summary" => list_time_summaries(store).and_then(to_response),
        "overview.snapshot" => build_overview_snapshot(store).and_then(to_response),
        _ => return None,
    };
    Some(result)
}

pub fn touch_project_session(store: &MissionStore, project_id: &str) -> MissionResult<()> {
    let now = unix_now();
    store.with(|conn| {
        let last: Option<(i64, i64)> = conn
            .query_row(
                "SELECT id, last_seen_at FROM mc_project_sessions WHERE project_id = ?1 ORDER BY id DESC LIMIT 1",
                params![project_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((session_id, last_seen)) = last {
            if now - last_seen <= SESSION_GAP_SECONDS {
                conn.execute(
                    "UPDATE mc_project_sessions SET last_seen_at = ?2 WHERE id = ?1",
                    params![session_id, now],
                )?;
                return Ok(());
            }
        }

        conn.execute(
            "INSERT INTO mc_project_sessions (project_id, started_at, last_seen_at) VALUES (?1, ?2, ?3)",
            params![project_id, now, now + 60],
        )?;
        Ok(())
    })
}

pub fn list_time_summaries(store: &MissionStore) -> MissionResult<Vec<ProjectTimeSummary>> {
    store.with(|conn| {
        let mut stmt = conn.prepare(
            r#"SELECT p.id, p.name,
                      COALESCE(SUM(MAX(60, s.last_seen_at - s.started_at)), 0) / 60 AS minutes,
                      COUNT(s.id) AS sessions,
                      COALESCE(MAX(s.last_seen_at), p.modified_at) AS last_at
               FROM mc_projects p
               LEFT JOIN mc_project_sessions s ON s.project_id = p.id
               WHERE p.is_ignored = 0
               GROUP BY p.id
               ORDER BY minutes DESC, p.modified_at DESC
               LIMIT 25"#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectTimeSummary {
                project_id: row.get(0)?,
                project_name: row.get(1)?,
                total_minutes: row.get(2)?,
                session_count: row.get(3)?,
                last_session_at: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    })
}

pub fn build_overview_snapshot(store: &MissionStore) -> MissionResult<OverviewSnapshot> {
    let mut projects = project_catalog::cached_catalog(store)?;
    if projects.is_empty() {
        projects = project_catalog::refresh_catalog(store)?;
    }

    let visible: Vec<ProjectSummary> = projects.into_iter().filter(|p| !p.is_ignored).collect();
    let total_projects = visible.len();
    let active_projects = visible.iter().filter(|p| p.status == "active").count();
    let production_projects = visible.iter().filter(|p| p.status == "production").count();

    let dev_ports = ports::scan_active_ports(store, true).unwrap_or_default();
    let git_repos = git::inspect_git_fleet(store).unwrap_or_default();
    let artifacts = disk::scan_artifacts(store).unwrap_or_default();

    let dirty_git_repos = git_repos.iter().filter(|r| r.is_dirty).count();
    let reclaimable_bytes: u64 = artifacts.iter().map(|a| a.size_bytes).sum();

    let alerts = evaluate_alerts(&visible, &git_repos, &dev_ports);
    let mut recent_projects = visible;
    recent_projects.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    recent_projects.truncate(8);

    let time_summaries = list_time_summaries(store).unwrap_or_default();

    Ok(OverviewSnapshot {
        total_projects,
        active_projects,
        production_projects,
        listening_dev_ports: dev_ports.len(),
        dirty_git_repos,
        reclaimable_bytes,
        alerts,
        recent_projects,
        time_summaries,
    })
}

/// Fonction pure : génère les alertes actionnables à partir de l'état des projets, dépôts et ports.
pub fn evaluate_alerts(
    projects: &[ProjectSummary],
    git_repos: &[GitRepoStatus],
    dev_ports: &[ActivePortEntry],
) -> Vec<DashboardAlert> {
    let mut alerts = Vec::new();
    let now = unix_now();
    let dormant_cutoff = now - DORMANT_PROJECT_DAYS * 86_400;

    for repo in git_repos {
        if repo.behind > 0 {
            alerts.push(DashboardAlert {
                severity: "warning".to_string(),
                code: "GIT_BEHIND".to_string(),
                title: format!("{} est en retard de {} commit(s)", repo.project_name, repo.behind),
                detail: format!("Branche `{}` derrière l'origine distante.", repo.branch),
                project_id: Some(repo.project_id.clone()),
            });
        }
        if repo.modified_count + repo.untracked_count >= 10 {
            alerts.push(DashboardAlert {
                severity: "info".to_string(),
                code: "GIT_UNCOMMITTED".to_string(),
                title: format!(
                    "{} fichiers non commités dans {}",
                    repo.modified_count + repo.untracked_count,
                    repo.project_name
                ),
                detail: format!("Branche `{}` — pense à commiter ou stasher.", repo.branch),
                project_id: Some(repo.project_id.clone()),
            });
        }
    }

    for proj in projects {
        if proj.status == "active" && proj.modified_at > 0 && proj.modified_at < dormant_cutoff {
            alerts.push(DashboardAlert {
                severity: "info".to_string(),
                code: "PROJECT_DORMANT".to_string(),
                title: format!("Projet actif sans modification récente : {}", proj.name),
                detail: "Aucune activité depuis plus de 30 jours — passer en `paused` ?".to_string(),
                project_id: Some(proj.id.clone()),
            });
        }
    }

    if dev_ports.len() >= 5 {
        alerts.push(DashboardAlert {
            severity: "warning".to_string(),
            code: "PORTS_CROWDED".to_string(),
            title: format!("{} ports de développement en écoute simultanée", dev_ports.len()),
            detail: "Vérifie le Radar des Ports pour libérer les serveurs inutilisés.".to_string(),
            project_id: None,
        });
    }

    alerts.truncate(10);
    alerts
}
