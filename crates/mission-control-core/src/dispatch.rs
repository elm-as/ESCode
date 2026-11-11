use crate::mission_error::{MissionError, MissionResult};
use crate::projects::{project_catalog, project_commands};
use crate::storage::connection::MissionStore;
use crate::{disk, env_vault, git, ports, scripts, sessions, system};
use serde_json::Value;
use std::path::Path;

/// Point d'entrée unique d'Elmas Mission Control.
///
/// L'app Tauri (`mc_dispatch`) et le binaire `elmas-mc serve` de l'extension appellent
/// exactement cette méthode avec les mêmes noms de commande : il n'existe qu'une seule
/// implémentation de chaque règle métier (ADR-008).
pub struct MissionControl {
    store: MissionStore,
}

/// Signature commune des gestionnaires de domaine : `None` si la commande ne les concerne pas.
type DomainHandler = fn(&MissionStore, &str, &Value) -> Option<MissionResult<Value>>;

const DOMAIN_HANDLERS: &[DomainHandler] = &[
    project_commands::handle,
    ports::handle,
    system::handle,
    git::handle,
    disk::handle,
    env_vault::handle,
    scripts::handle,
    sessions::handle,
];

impl MissionControl {
    pub fn open(database_path: &Path) -> MissionResult<Self> {
        Self::from_store(MissionStore::open(database_path)?)
    }

    pub fn open_in_memory() -> MissionResult<Self> {
        Self::from_store(MissionStore::open_in_memory()?)
    }

    fn from_store(store: MissionStore) -> MissionResult<Self> {
        if store.is_fresh() {
            project_catalog::seed_default_root(&store)?;
        }
        Ok(Self { store })
    }

    pub fn dispatch(&self, command: &str, payload: Value) -> MissionResult<Value> {
        for handler in DOMAIN_HANDLERS {
            if let Some(result) = handler(&self.store, command, &payload) {
                return result;
            }
        }
        Err(MissionError::new("UNKNOWN_COMMAND", format!("Commande inconnue : {command}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn unknown_command_is_reported() {
        let control = MissionControl::open_in_memory().unwrap();
        let error = control.dispatch("nope.nothing", Value::Null).unwrap_err();
        assert_eq!(error.code, "UNKNOWN_COMMAND");
    }

    #[test]
    fn project_tracking_round_trip() {
        let control = MissionControl::open_in_memory().unwrap();
        let samples = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test-projects/flutter-mobile");
        let added = control
            .dispatch("projects.addManual", json!({ "path": samples.to_string_lossy() }))
            .unwrap();
        let project_id = added["id"].as_str().unwrap().to_string();
        assert_eq!(added["stack"], "flutter");

        control
            .dispatch("projects.update", json!({ "projectId": project_id, "patch": { "status": "active" } }))
            .unwrap();
        control
            .dispatch("tasks.add", json!({ "projectId": project_id, "title": "Écran de connexion" }))
            .unwrap();
        control
            .dispatch("projects.setTags", json!({ "projectId": project_id, "tags": ["Mobile", "client"] }))
            .unwrap();

        let detail = control.dispatch("projects.detail", json!({ "projectId": project_id })).unwrap();
        assert_eq!(detail["summary"]["status"], "active");
        assert_eq!(detail["summary"]["taskTotal"], 1);
        assert_eq!(detail["summary"]["tags"], json!(["client", "mobile"]));
        assert_eq!(detail["tasks"][0]["title"], "Écran de connexion");
    }

    #[test]
    fn invalid_status_is_rejected() {
        let control = MissionControl::open_in_memory().unwrap();
        let error = control
            .dispatch("projects.update", json!({ "projectId": "x", "patch": { "status": "done" } }))
            .unwrap_err();
        assert_eq!(error.code, "INVALID_PAYLOAD");
    }
}
