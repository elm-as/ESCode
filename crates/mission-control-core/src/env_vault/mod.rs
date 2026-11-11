use crate::command_payload::{acknowledged, parse_payload, to_response};
use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_catalog;
use crate::storage::connection::MissionStore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

/// Rapport d'inspection `.env` d'un projet : aucune valeur secrète n'y figure en clair.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvInspectionReport {
    pub project_id: String,
    pub files_found: Vec<String>,
    pub entries: Vec<EnvKeyStatus>,
    pub missing_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvKeyStatus {
    pub key: String,
    pub is_empty: bool,
    pub value_length: usize,
    pub in_example: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRef {
    project_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RevealInput {
    project_id: String,
    key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetEnvInput {
    project_id: String,
    key: String,
    value: String,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "env.inspect" => parse_payload::<ProjectRef>(payload)
            .and_then(|input| inspect_project_env(store, &input.project_id))
            .and_then(to_response),
        "env.reveal" => parse_payload::<RevealInput>(payload)
            .and_then(|input| reveal_env_value(store, &input.project_id, &input.key))
            .and_then(to_response),
        "env.set" => parse_payload::<SetEnvInput>(payload)
            .and_then(|input| write_env_key(store, &input))
            .and_then(|_| acknowledged()),
        _ => return None,
    };
    Some(result)
}

pub fn inspect_project_env(store: &MissionStore, project_id: &str) -> MissionResult<EnvInspectionReport> {
    let root = project_catalog::project_path(store, project_id)?;
    let candidates = [".env", ".env.local", ".env.development", ".env.example", ".env.sample"];
    let files_found: Vec<String> = candidates
        .iter()
        .filter(|name| root.join(name).is_file())
        .map(|name| (*name).to_string())
        .collect();

    let active_vars = read_merged_env(&root, &[".env", ".env.local"]);
    let example_vars = read_merged_env(&root, &[".env.example", ".env.sample"]);

    let mut entries = Vec::new();
    for (key, val) in &active_vars {
        entries.push(EnvKeyStatus {
            key: key.clone(),
            is_empty: val.is_empty(),
            value_length: val.len(),
            in_example: example_vars.contains_key(key),
        });
    }

    let missing_keys: Vec<String> = example_vars
        .keys()
        .filter(|key| !active_vars.contains_key(*key))
        .cloned()
        .collect();

    Ok(EnvInspectionReport {
        project_id: project_id.to_string(),
        files_found,
        entries,
        missing_keys,
    })
}

fn reveal_env_value(store: &MissionStore, project_id: &str, key: &str) -> MissionResult<String> {
    let root = project_catalog::project_path(store, project_id)?;
    let vars = read_merged_env(&root, &[".env", ".env.local"]);
    vars.get(key)
        .cloned()
        .ok_or_else(|| MissionError::not_found("Clé .env"))
}

fn write_env_key(store: &MissionStore, input: &SetEnvInput) -> MissionResult<()> {
    let key = input.key.trim();
    if key.is_empty() || key.contains('=') || key.contains('\n') {
        return Err(MissionError::invalid_payload("Nom de variable d'environnement invalide"));
    }
    let root = project_catalog::project_path(store, &input.project_id)?;
    let env_path = root.join(".env");
    let existing = fs::read_to_string(&env_path).unwrap_or_default();
    let updated = upsert_env_content(&existing, key, &input.value);
    fs::write(&env_path, updated)
        .map_err(|err| MissionError::new("ENV_WRITE_FAILED", format!("Impossible d'écrire `.env` : {err}")))
}

fn read_merged_env(root: &Path, names: &[&str]) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for name in names {
        let Ok(content) = fs::read_to_string(root.join(name)) else {
            continue;
        };
        for (k, v) in parse_dotenv(&content) {
            map.insert(k, v);
        }
    }
    map
}

/// Fonction pure : extrait les paires `CLE=VALEUR` d'un fichier `.env`.
pub fn parse_dotenv(content: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let stripped = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, value)) = stripped.split_once('=') else {
            continue;
        };
        let clean_key = key.trim();
        if clean_key.is_empty() {
            continue;
        }
        let clean_val = value.trim().trim_matches('"').trim_matches('\'').to_string();
        map.insert(clean_key.to_string(), clean_val);
    }
    map
}

/// Fonction pure : met à jour ou ajoute une clé dans le texte d'un fichier `.env`.
pub fn upsert_env_content(existing: &str, key: &str, value: &str) -> String {
    let prefix = format!("{key}=");
    let mut replaced = false;
    let mut lines: Vec<String> = existing
        .lines()
        .map(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with(&prefix) {
                replaced = true;
                format!("{key}={value}")
            } else {
                line.to_string()
            }
        })
        .collect();

    if !replaced {
        lines.push(format!("{key}={value}"));
    }
    format!("{}\n", lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_dotenv_and_upserts_keys() {
        let sample = "# Comment\nPORT=5173\nAPI_URL=\"https://api.example.com\"\n";
        let map = parse_dotenv(sample);
        assert_eq!(map.get("PORT").map(String::as_str), Some("5173"));
        assert_eq!(map.get("API_URL").map(String::as_str), Some("https://api.example.com"));

        let updated = upsert_env_content(sample, "PORT", "3000");
        let map2 = parse_dotenv(&updated);
        assert_eq!(map2.get("PORT").map(String::as_str), Some("3000"));
    }
}

