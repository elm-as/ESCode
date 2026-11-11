use crate::mission_error::MissionResult;
use rusqlite::Connection;

/// Migrations versionnées via `PRAGMA user_version`.
///
/// Les tables historiques de l'IDE (`settings`, `recent_projects`, `device_profiles`) ne sont
/// pas versionnées et restent gérées par `src-tauri` : Mission Control préfixe toutes ses
/// tables par `mc_` pour ne jamais entrer en collision avec elles.
const MIGRATIONS: &[&str] = &[
    // v1 — recueil de projets et suivi
    r#"
    CREATE TABLE mc_scan_roots (
        path TEXT PRIMARY KEY,
        added_at INTEGER NOT NULL
    );
    CREATE TABLE mc_projects (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        stack TEXT NOT NULL,
        ui_framework TEXT NOT NULL DEFAULT '',
        has_git INTEGER NOT NULL DEFAULT 0,
        modified_at INTEGER NOT NULL DEFAULT 0,
        last_seen_at INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'idea',
        priority INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_ignored INTEGER NOT NULL DEFAULT 0,
        is_manual INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        notes_md TEXT NOT NULL DEFAULT '',
        repo_url TEXT NOT NULL DEFAULT '',
        prod_url TEXT NOT NULL DEFAULT '',
        netlify_site_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE mc_project_tags (
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (project_id, tag)
    );
    CREATE TABLE mc_project_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_done INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE mc_project_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        due_date INTEGER,
        reached_at INTEGER
    );
    CREATE TABLE mc_project_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        started_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
    );
    CREATE TABLE mc_project_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        command_line TEXT NOT NULL
    );
    CREATE TABLE mc_activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        at INTEGER NOT NULL
    );
    CREATE TABLE mc_artifact_cache (
        project_id TEXT NOT NULL REFERENCES mc_projects(id) ON DELETE CASCADE,
        dir_name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        computed_at INTEGER NOT NULL,
        PRIMARY KEY (project_id, dir_name)
    );
    CREATE INDEX mc_sessions_by_project ON mc_project_sessions(project_id, started_at);
    CREATE INDEX mc_activity_by_time ON mc_activity_events(at);
    "#,
];

/// Applique les migrations manquantes. Retourne `true` si la base vient d'être initialisée
/// (premier lancement), ce qui déclenche le peuplement des réglages par défaut.
pub fn apply_migrations(connection: &Connection) -> MissionResult<bool> {
    let current: usize = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        connection.execute_batch(&format!("BEGIN; {sql} PRAGMA user_version = {}; COMMIT;", index + 1))?;
    }
    Ok(current == 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let connection = Connection::open_in_memory().unwrap();
        apply_migrations(&connection).unwrap();
        apply_migrations(&connection).unwrap();
        let version: usize = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len());
    }

    #[test]
    fn migrations_coexist_with_legacy_ide_tables() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
            .unwrap();
        apply_migrations(&connection).unwrap();
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
