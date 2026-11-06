use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingItem {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub id: Option<i64>,
    pub path: String,
    pub name: String,
    pub framework: String,
    pub last_opened: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceProfile {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub dpi: f32,
    pub is_default: bool,
}

pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

impl DatabaseManager {
    pub fn new<P: AsRef<Path>>(path: P) -> std::result::Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        let mgr = Self {
            conn: Mutex::new(conn),
        };
        mgr.run_migrations()?;
        mgr.seed_device_profiles_if_empty()?;
        Ok(mgr)
    }

    pub fn new_in_memory() -> std::result::Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
        let mgr = Self {
            conn: Mutex::new(conn),
        };
        mgr.run_migrations()?;
        mgr.seed_device_profiles_if_empty()?;
        Ok(mgr)
    }

    fn run_migrations(&self) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recent_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                framework TEXT NOT NULL,
                last_opened INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS device_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                dpi REAL NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .map_err(|e| format!("Failed to run database migrations: {e}"))?;

        Ok(())
    }

    fn seed_device_profiles_if_empty(&self) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM device_profiles", [], |row| row.get(0))
            .unwrap_or(0);

        if count > 0 {
            return Ok(());
        }

        let defaults = [
            ("compact-360", "Compact Phone (360×800)", 360, 800, 2.0, 0),
            ("standard-375", "iPhone SE / Standard (375×812)", 375, 812, 3.0, 0),
            ("flagship-390", "Flagship Modern (390×844)", 390, 844, 3.0, 1),
            ("pixel-412", "Pixel 8 / Large (412×915)", 412, 915, 2.625, 0),
            ("pro-max-432", "Pro Max / Ultra (432×960)", 432, 960, 3.0, 0),
        ];

        for (id, name, width, height, dpi, is_default) in defaults {
            let _ = conn.execute(
                "INSERT OR REPLACE INTO device_profiles (id, name, width, height, dpi, is_default) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, name, width, height, dpi, is_default],
            );
        }

        Ok(())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> std::result::Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;

        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let val: String = row.get(0).map_err(|e| e.to_string())?;
            return Ok(Some(val));
        }

        Ok(None)
    }

    pub fn get_all_settings(&self) -> std::result::Result<Vec<SettingItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SettingItem {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }

    pub fn add_recent_project(
        &self,
        path: &str,
        name: &str,
        framework: &str,
    ) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            r#"
            INSERT INTO recent_projects (path, name, framework, last_opened)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(path) DO UPDATE SET
                name = ?2,
                framework = ?3,
                last_opened = ?4
            "#,
            params![path, name, framework, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_recent_projects(&self) -> std::result::Result<Vec<RecentProject>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, path, name, framework, last_opened FROM recent_projects ORDER BY last_opened DESC LIMIT 20")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(RecentProject {
                    id: Some(row.get(0)?),
                    path: row.get(1)?,
                    name: row.get(2)?,
                    framework: row.get(3)?,
                    last_opened: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }

    pub fn get_device_profiles(&self) -> std::result::Result<Vec<DeviceProfile>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, width, height, dpi, is_default FROM device_profiles ORDER BY width ASC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let is_def: i32 = row.get(5)?;
                Ok(DeviceProfile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    width: row.get(2)?,
                    height: row.get(3)?,
                    dpi: row.get(4)?,
                    is_default: is_def != 0,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_db_migrations_and_profiles() {
        let db = DatabaseManager::new_in_memory().expect("db creation failed");
        let profiles = db.get_device_profiles().expect("profiles query failed");
        assert_eq!(profiles.len(), 5);
        assert_eq!(profiles[0].width, 360);
    }

    #[test]
    fn test_settings_save_and_retrieve() {
        let db = DatabaseManager::new_in_memory().expect("db creation failed");
        db.set_setting("theme", "dark").expect("save setting failed");
        let val = db.get_setting("theme").expect("get setting failed");
        assert_eq!(val, Some("dark".to_string()));
    }

    #[test]
    fn test_recent_projects() {
        let db = DatabaseManager::new_in_memory().expect("db creation failed");
        db.add_recent_project("C:/test/proj", "Proj", "react_web")
            .expect("add project failed");
        let list = db.get_recent_projects().expect("get projects failed");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Proj");
    }
}

