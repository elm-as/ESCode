use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_model::{ProjectCommand, ProjectMilestone, ProjectTask};
use crate::storage::connection::unix_now;
use rusqlite::{params, Connection};

pub fn list_tasks(connection: &Connection, project_id: &str) -> MissionResult<Vec<ProjectTask>> {
    let mut statement = connection.prepare(
        "SELECT id, title, is_done, position FROM mc_project_tasks WHERE project_id = ?1 ORDER BY is_done, position",
    )?;
    let rows = statement.query_map(params![project_id], |row| {
        Ok(ProjectTask {
            id: row.get(0)?,
            title: row.get(1)?,
            is_done: row.get(2)?,
            position: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(MissionError::from)
}

pub fn add_task(connection: &Connection, project_id: &str, title: &str) -> MissionResult<i64> {
    let title = require_text(title, "Le titre de la tâche")?;
    connection.execute(
        r#"INSERT INTO mc_project_tasks (project_id, title, position, created_at)
           VALUES (?1, ?2, (SELECT COALESCE(MAX(position), 0) + 1 FROM mc_project_tasks WHERE project_id = ?1), ?3)"#,
        params![project_id, title, unix_now()],
    )?;
    Ok(connection.last_insert_rowid())
}

pub fn toggle_task(connection: &Connection, task_id: i64) -> MissionResult<()> {
    let changed = connection.execute(
        "UPDATE mc_project_tasks SET is_done = 1 - is_done WHERE id = ?1",
        params![task_id],
    )?;
    ensure_changed(changed, "Tâche")
}

pub fn delete_task(connection: &Connection, task_id: i64) -> MissionResult<()> {
    let changed = connection.execute("DELETE FROM mc_project_tasks WHERE id = ?1", params![task_id])?;
    ensure_changed(changed, "Tâche")
}

pub fn list_milestones(connection: &Connection, project_id: &str) -> MissionResult<Vec<ProjectMilestone>> {
    let mut statement = connection.prepare(
        r#"SELECT id, title, due_date, reached_at FROM mc_project_milestones
           WHERE project_id = ?1 ORDER BY reached_at IS NOT NULL, due_date IS NULL, due_date"#,
    )?;
    let rows = statement.query_map(params![project_id], |row| {
        Ok(ProjectMilestone {
            id: row.get(0)?,
            title: row.get(1)?,
            due_date: row.get(2)?,
            reached_at: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(MissionError::from)
}

/// Nouveau jalon : titre obligatoire, échéance optionnelle (timestamp Unix).
pub struct MilestoneDraft<'a> {
    pub project_id: &'a str,
    pub title: &'a str,
    pub due_date: Option<i64>,
}

pub fn add_milestone(connection: &Connection, draft: &MilestoneDraft) -> MissionResult<i64> {
    let title = require_text(draft.title, "Le titre du jalon")?;
    connection.execute(
        "INSERT INTO mc_project_milestones (project_id, title, due_date) VALUES (?1, ?2, ?3)",
        params![draft.project_id, title, draft.due_date],
    )?;
    Ok(connection.last_insert_rowid())
}

/// Bascule un jalon entre « atteint maintenant » et « non atteint ».
pub fn toggle_milestone(connection: &Connection, milestone_id: i64) -> MissionResult<()> {
    let changed = connection.execute(
        r#"UPDATE mc_project_milestones
           SET reached_at = CASE WHEN reached_at IS NULL THEN ?2 ELSE NULL END WHERE id = ?1"#,
        params![milestone_id, unix_now()],
    )?;
    ensure_changed(changed, "Jalon")
}

pub fn delete_milestone(connection: &Connection, milestone_id: i64) -> MissionResult<()> {
    let changed = connection.execute("DELETE FROM mc_project_milestones WHERE id = ?1", params![milestone_id])?;
    ensure_changed(changed, "Jalon")
}

pub fn list_commands(connection: &Connection, project_id: &str) -> MissionResult<Vec<ProjectCommand>> {
    let mut statement = connection
        .prepare("SELECT id, label, command_line FROM mc_project_commands WHERE project_id = ?1 ORDER BY label")?;
    let rows = statement.query_map(params![project_id], |row| {
        Ok(ProjectCommand {
            id: row.get(0)?,
            label: row.get(1)?,
            command_line: row.get(2)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(MissionError::from)
}

pub fn add_command(connection: &Connection, project_id: &str, command: &ProjectCommand) -> MissionResult<i64> {
    let label = require_text(&command.label, "Le libellé")?;
    let command_line = require_text(&command.command_line, "La commande")?;
    connection.execute(
        "INSERT INTO mc_project_commands (project_id, label, command_line) VALUES (?1, ?2, ?3)",
        params![project_id, label, command_line],
    )?;
    Ok(connection.last_insert_rowid())
}

pub fn delete_command(connection: &Connection, command_id: i64) -> MissionResult<()> {
    let changed = connection.execute("DELETE FROM mc_project_commands WHERE id = ?1", params![command_id])?;
    ensure_changed(changed, "Commande")
}

pub fn list_scan_roots(connection: &Connection) -> MissionResult<Vec<String>> {
    let mut statement = connection.prepare("SELECT path FROM mc_scan_roots ORDER BY added_at")?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<Result<Vec<String>, _>>().map_err(MissionError::from)
}

pub fn add_scan_root(connection: &Connection, path: &str) -> MissionResult<()> {
    connection.execute(
        "INSERT OR IGNORE INTO mc_scan_roots (path, added_at) VALUES (?1, ?2)",
        params![path, unix_now()],
    )?;
    Ok(())
}

pub fn remove_scan_root(connection: &Connection, path: &str) -> MissionResult<()> {
    let changed = connection.execute("DELETE FROM mc_scan_roots WHERE path = ?1", params![path])?;
    ensure_changed(changed, "Dossier racine")
}

fn require_text<'a>(value: &'a str, label: &str) -> MissionResult<&'a str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(MissionError::invalid_payload(format!("{label} ne peut pas être vide")));
    }
    Ok(trimmed)
}

fn ensure_changed(changed: usize, what: &str) -> MissionResult<()> {
    if changed == 0 {
        return Err(MissionError::not_found(what));
    }
    Ok(())
}

