use crate::mission_error::{MissionError, MissionResult};
use crate::projects::discovery::DiscoveredProject;
use crate::projects::project_model::{ProjectPatch, ProjectSummary};
use crate::storage::connection::unix_now;
use rusqlite::{params, Connection, Row, ToSql};

/// Enregistre ou rafraîchit les projets trouvés sur disque, sans jamais écraser
/// les métadonnées saisies par l'utilisateur (statut, notes, priorité…).
pub fn upsert_discovered(connection: &mut Connection, projects: &[DiscoveredProject]) -> MissionResult<i64> {
    let scan_time = unix_now();
    let transaction = connection.transaction()?;
    {
        let mut statement = transaction.prepare(
            r#"INSERT INTO mc_projects (id, path, name, stack, ui_framework, has_git, modified_at,
                                        last_seen_at, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?8)
               ON CONFLICT(id) DO UPDATE SET
                   path = ?2, name = ?3, stack = ?4, ui_framework = ?5,
                   has_git = ?6, modified_at = ?7, last_seen_at = ?8"#,
        )?;
        for project in projects {
            statement.execute(params![
                project.id,
                project.path,
                project.name,
                project.detection.stack,
                project.detection.ui_framework.clone().unwrap_or_default(),
                project.has_git,
                project.modified_at,
                scan_time,
            ])?;
        }
    }
    transaction.commit()?;
    Ok(scan_time)
}

const SUMMARY_SELECT: &str = r#"
    SELECT p.id, p.path, p.name, p.stack, p.ui_framework, p.status, p.priority,
           p.is_pinned, p.is_ignored, p.is_manual, p.has_git, p.description,
           p.repo_url, p.prod_url, p.modified_at, p.last_seen_at,
           (SELECT COUNT(*) FROM mc_project_tasks t WHERE t.project_id = p.id),
           (SELECT COUNT(*) FROM mc_project_tasks t WHERE t.project_id = p.id AND t.is_done = 1),
           (SELECT GROUP_CONCAT(tag, char(31)) FROM mc_project_tags g WHERE g.project_id = p.id)
    FROM mc_projects p
"#;

/// Liste tous les projets suivis. `scan_time` sert à marquer les projets disparus du disque.
pub fn list_summaries(connection: &Connection, scan_time: i64) -> MissionResult<Vec<ProjectSummary>> {
    let sql = format!("{SUMMARY_SELECT} ORDER BY p.is_pinned DESC, p.priority DESC, p.name COLLATE NOCASE");
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map([], |row| map_summary(row, scan_time))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(MissionError::from)
}

pub fn find_summary(connection: &Connection, project_id: &str) -> MissionResult<ProjectSummary> {
    let sql = format!("{SUMMARY_SELECT} WHERE p.id = ?1");
    connection
        .query_row(&sql, params![project_id], |row| map_summary(row, 0))
        .map_err(|_| MissionError::not_found("Projet"))
}

fn map_summary(row: &Row, scan_time: i64) -> rusqlite::Result<ProjectSummary> {
    let last_seen_at: i64 = row.get(15)?;
    let is_manual: bool = row.get(9)?;
    let tags: Option<String> = row.get(18)?;
    Ok(ProjectSummary {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        stack: row.get(3)?,
        ui_framework: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        is_pinned: row.get(7)?,
        is_ignored: row.get(8)?,
        is_manual,
        has_git: row.get(10)?,
        description: row.get(11)?,
        repo_url: row.get(12)?,
        prod_url: row.get(13)?,
        modified_at: row.get(14)?,
        is_on_disk: scan_time == 0 || last_seen_at >= scan_time,
        tags: split_tags(tags),
        task_total: row.get(16)?,
        task_done: row.get(17)?,
    })
}

fn split_tags(joined: Option<String>) -> Vec<String> {
    let Some(text) = joined else {
        return Vec::new();
    };
    let mut tags: Vec<String> = text.split('\u{1f}').map(str::to_string).collect();
    tags.sort();
    tags
}

pub fn read_notes(connection: &Connection, project_id: &str) -> MissionResult<(String, String)> {
    connection
        .query_row(
            "SELECT notes_md, netlify_site_id FROM mc_projects WHERE id = ?1",
            params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| MissionError::not_found("Projet"))
}

/// Applique un patch partiel. Chaque champ présent produit une clause `SET` paramétrée.
pub fn apply_patch(connection: &Connection, project_id: &str, patch: &ProjectPatch) -> MissionResult<()> {
    let mut clauses: Vec<&str> = Vec::new();
    let mut values: Vec<Box<dyn ToSql>> = Vec::new();
    let mut push = |clause: &'static str, value: Box<dyn ToSql>| {
        clauses.push(clause);
        values.push(value);
    };
    if let Some(v) = &patch.status { push("status = ?", Box::new(v.clone())); }
    if let Some(v) = patch.priority { push("priority = ?", Box::new(v)); }
    if let Some(v) = patch.is_pinned { push("is_pinned = ?", Box::new(v)); }
    if let Some(v) = patch.is_ignored { push("is_ignored = ?", Box::new(v)); }
    if let Some(v) = &patch.description { push("description = ?", Box::new(v.clone())); }
    if let Some(v) = &patch.notes_md { push("notes_md = ?", Box::new(v.clone())); }
    if let Some(v) = &patch.repo_url { push("repo_url = ?", Box::new(v.clone())); }
    if let Some(v) = &patch.prod_url { push("prod_url = ?", Box::new(v.clone())); }
    if let Some(v) = &patch.netlify_site_id { push("netlify_site_id = ?", Box::new(v.clone())); }
    if clauses.is_empty() {
        return Ok(());
    }
    values.push(Box::new(unix_now()));
    values.push(Box::new(project_id.to_string()));
    let sql = format!("UPDATE mc_projects SET {}, updated_at = ? WHERE id = ?", clauses.join(", "));
    let parameters: Vec<&dyn ToSql> = values.iter().map(|value| value.as_ref()).collect();
    let changed = connection.execute(&sql, parameters.as_slice())?;
    if changed == 0 {
        return Err(MissionError::not_found("Projet"));
    }
    Ok(())
}

pub fn replace_tags(connection: &mut Connection, project_id: &str, tags: &[String]) -> MissionResult<()> {
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM mc_project_tags WHERE project_id = ?1", params![project_id])?;
    for tag in tags.iter().map(|tag| tag.trim()).filter(|tag| !tag.is_empty()) {
        transaction.execute(
            "INSERT OR IGNORE INTO mc_project_tags (project_id, tag) VALUES (?1, ?2)",
            params![project_id, tag.to_lowercase()],
        )?;
    }
    transaction.commit()?;
    Ok(())
}

pub fn mark_manual(connection: &Connection, project_id: &str) -> MissionResult<()> {
    connection.execute("UPDATE mc_projects SET is_manual = 1 WHERE id = ?1", params![project_id])?;
    Ok(())
}

pub fn manual_project_paths(connection: &Connection) -> MissionResult<Vec<String>> {
    let mut statement = connection.prepare("SELECT path FROM mc_projects WHERE is_manual = 1")?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<String>, _>>().map_err(MissionError::from)
}

