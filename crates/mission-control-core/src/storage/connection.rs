use crate::mission_error::{MissionError, MissionResult};
use crate::storage::migrations::apply_migrations;
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Mutex, MutexGuard};

/// Propriétaire unique de la connexion SQLite du domaine Mission Control.
///
/// La base est partagée avec l'app Tauri (même fichier `elmas_studio.db`) : le mode WAL
/// permet à l'IDE Tauri et au process `elmas-mc` de l'extension de lire/écrire en même temps.
pub struct MissionStore {
    connection: Mutex<Connection>,
    is_fresh: bool,
}

impl MissionStore {
    pub fn open(path: &Path) -> MissionResult<Self> {
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        Self::initialize(connection)
    }

    pub fn open_in_memory() -> MissionResult<Self> {
        Self::initialize(Connection::open_in_memory()?)
    }

    fn initialize(connection: Connection) -> MissionResult<Self> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        let is_fresh = apply_migrations(&connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
            is_fresh,
        })
    }

    /// Vrai si la base Mission Control a été créée par cette ouverture.
    pub fn is_fresh(&self) -> bool {
        self.is_fresh
    }

    pub fn lock(&self) -> MissionResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| MissionError::storage("verrou SQLite empoisonné"))
    }

    /// Exécute une opération de dépôt avec la connexion verrouillée le temps de l'appel.
    pub fn with<T>(&self, operation: impl FnOnce(&Connection) -> MissionResult<T>) -> MissionResult<T> {
        let connection = self.lock()?;
        operation(&connection)
    }
}

/// Horodatage Unix en secondes, source unique pour toutes les écritures.
pub fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
