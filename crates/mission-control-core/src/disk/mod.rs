use crate::command_payload::{parse_payload, to_response};
use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_catalog;
use crate::storage::connection::{unix_now, MissionStore};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;

/// Liste blanche stricte des seuls sous-dossiers d'artefacts régénérables autorisés à la purge.
pub const WHITELISTED_ARTIFACT_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "build",
    ".dart_tool",
    "dist",
    ".next",
    ".gradle",
    ".venv",
    "__pycache__",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectArtifactEntry {
    pub project_id: String,
    pub project_name: String,
    pub project_status: String,
    pub dir_name: String,
    pub full_path: String,
    pub size_bytes: u64,
    pub computed_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PurgeArtifactInput {
    project_id: String,
    dir_name: String,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "disk.scan" => scan_artifacts(store).and_then(to_response),
        "disk.purge" => parse_payload::<PurgeArtifactInput>(payload)
            .and_then(|input| purge_artifact(store, &input.project_id, &input.dir_name))
            .and_then(to_response),
        _ => return None,
    };
    Some(result)
}

pub fn scan_artifacts(store: &MissionStore) -> MissionResult<Vec<ProjectArtifactEntry>> {
    let mut projects = project_catalog::cached_catalog(store)?;
    if projects.is_empty() {
        projects = project_catalog::refresh_catalog(store)?;
    }

    let mut entries = Vec::new();
    let now = unix_now();

    for project in projects.iter().filter(|p| p.is_on_disk && !p.is_ignored) {
        let root = Path::new(&project.path);
        for &dir_name in WHITELISTED_ARTIFACT_DIRS {
            let candidate = root.join(dir_name);
            if !candidate.is_dir() {
                continue;
            }
            let query = ArtifactSizeQuery {
                project_id: &project.id,
                dir_name,
                candidate: &candidate,
                now,
            };
            let size_bytes = read_or_compute_size(store, &query);
            if size_bytes == 0 {
                continue;
            }
            entries.push(ProjectArtifactEntry {
                project_id: project.id.clone(),
                project_name: project.name.clone(),
                project_status: project.status.clone(),
                dir_name: dir_name.to_string(),
                full_path: candidate.to_string_lossy().into_owned(),
                size_bytes,
                computed_at: now,
            });
        }
    }

    entries.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(entries)
}

struct ArtifactSizeQuery<'a> {
    project_id: &'a str,
    dir_name: &'a str,
    candidate: &'a Path,
    now: i64,
}

fn read_or_compute_size(store: &MissionStore, query: &ArtifactSizeQuery) -> u64 {
    if let Ok(conn) = store.lock() {
        let cached: Option<(i64, i64)> = conn
            .query_row(
                "SELECT size_bytes, computed_at FROM mc_artifact_cache WHERE project_id = ?1 AND dir_name = ?2",
                params![query.project_id, query.dir_name],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        if let Some((size, ts)) = cached {
            if query.now - ts < 3600 && size > 0 {
                return size as u64;
            }
        }
    }

    let computed = compute_dir_size_bounded(query.candidate, 5);
    if let Ok(conn) = store.lock() {
        let _ = conn.execute(
            r#"INSERT INTO mc_artifact_cache (project_id, dir_name, size_bytes, computed_at)
               VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(project_id, dir_name) DO UPDATE SET size_bytes = ?3, computed_at = ?4"#,
            params![query.project_id, query.dir_name, computed as i64, query.now],
        );
    }
    computed
}

fn compute_dir_size_bounded(path: &Path, max_depth: usize) -> u64 {
    if max_depth == 0 {
        return 0;
    }
    let Ok(read_dir) = fs::read_dir(path) else {
        return 0;
    };
    let mut total = 0u64;
    for entry in read_dir.filter_map(Result::ok) {
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.is_file() {
            total = total.saturating_add(meta.len());
        } else if meta.is_dir() {
            total = total.saturating_add(compute_dir_size_bounded(&entry.path(), max_depth - 1));
        }
    }
    total
}

/// Supprime un dossier d'artefacts uniquement s'il appartient à la liste blanche stricte
/// et qu'il est un enfant direct de la racine du projet.
pub fn purge_artifact(store: &MissionStore, project_id: &str, dir_name: &str) -> MissionResult<u64> {
    if !WHITELISTED_ARTIFACT_DIRS.contains(&dir_name) {
        return Err(MissionError::invalid_payload(format!(
            "Dossier `{dir_name}` refusé : hors de la liste blanche de sécurité"
        )));
    }
    let project_root = project_catalog::project_path(store, project_id)?;
    let target = project_root.join(dir_name);
    if target.parent() != Some(project_root.as_path()) || !target.is_dir() {
        return Err(MissionError::not_found("Dossier d'artefacts"));
    }

    let freed = compute_dir_size_bounded(&target, 5);
    fs::remove_dir_all(&target)
        .map_err(|err| MissionError::new("PURGE_FAILED", format!("Impossible de supprimer `{dir_name}` : {err}")))?;

    store.with(|conn| {
        conn.execute(
            "DELETE FROM mc_artifact_cache WHERE project_id = ?1 AND dir_name = ?2",
            params![project_id, dir_name],
        )?;
        Ok(())
    })?;
    Ok(freed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_whitelisted_directory_names() {
        let store = MissionStore::open_in_memory().unwrap();
        let err = purge_artifact(&store, "any", "src").unwrap_err();
        assert_eq!(err.code, "INVALID_PAYLOAD");
    }
}
