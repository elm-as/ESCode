use crate::command_payload::{acknowledged, parse_payload, to_response};
use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_catalog;
use crate::projects::project_model::{is_valid_status, ProjectCommand, ProjectPatch};
use crate::storage::connection::MissionStore;
use crate::storage::tracking_repo::MilestoneDraft;
use crate::storage::{projects_repo, tracking_repo};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRef {
    project_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathRef {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdRef {
    id: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInput {
    project_id: String,
    patch: ProjectPatch,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TagsInput {
    project_id: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TitledInput {
    project_id: String,
    title: String,
    due_date: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandInput {
    project_id: String,
    label: String,
    command_line: String,
}

/// Commandes `projects.*`, `tasks.*`, `milestones.*`, `commands.*` et `roots.*`.
pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "projects.list" => project_catalog::refresh_catalog(store).and_then(to_response),
        "projects.cached" => project_catalog::cached_catalog(store).and_then(to_response),
        "projects.detail" => parse_payload::<ProjectRef>(payload)
            .and_then(|input| project_catalog::project_detail(store, &input.project_id))
            .and_then(to_response),
        "projects.update" => parse_payload::<UpdateInput>(payload).and_then(|input| update_project(store, input)),
        "projects.setTags" => parse_payload::<TagsInput>(payload).and_then(|input| set_tags(store, input)),
        "projects.addManual" => parse_payload::<PathRef>(payload)
            .and_then(|input| project_catalog::add_manual_project(store, &input.path))
            .and_then(to_response),
        "tasks.add" => parse_payload::<TitledInput>(payload).and_then(|input| {
            store.with(|c| tracking_repo::add_task(c, &input.project_id, &input.title)).and_then(to_response)
        }),
        "tasks.toggle" => by_id(store, payload, tracking_repo::toggle_task),
        "tasks.delete" => by_id(store, payload, tracking_repo::delete_task),
        "milestones.add" => parse_payload::<TitledInput>(payload).and_then(|input| add_milestone(store, input)),
        "milestones.toggle" => by_id(store, payload, tracking_repo::toggle_milestone),
        "milestones.delete" => by_id(store, payload, tracking_repo::delete_milestone),
        "commands.add" => parse_payload::<CommandInput>(payload).and_then(|input| add_command(store, input)),
        "commands.delete" => by_id(store, payload, tracking_repo::delete_command),
        "roots.list" => store.with(tracking_repo::list_scan_roots).and_then(to_response),
        "roots.add" => parse_payload::<PathRef>(payload).and_then(|input| add_root(store, &input.path)),
        "roots.remove" => parse_payload::<PathRef>(payload)
            .and_then(|input| store.with(|c| tracking_repo::remove_scan_root(c, &input.path)))
            .and_then(|_| acknowledged()),
        _ => return None,
    };
    Some(result)
}

fn update_project(store: &MissionStore, input: UpdateInput) -> MissionResult<Value> {
    if let Some(status) = &input.patch.status {
        if !is_valid_status(status) {
            return Err(MissionError::invalid_payload(format!("Statut inconnu : {status}")));
        }
    }
    store.with(|c| projects_repo::apply_patch(c, &input.project_id, &input.patch))?;
    acknowledged()
}

fn set_tags(store: &MissionStore, input: TagsInput) -> MissionResult<Value> {
    let mut connection = store.lock()?;
    projects_repo::replace_tags(&mut connection, &input.project_id, &input.tags)?;
    acknowledged()
}

fn add_milestone(store: &MissionStore, input: TitledInput) -> MissionResult<Value> {
    let draft = MilestoneDraft {
        project_id: &input.project_id,
        title: &input.title,
        due_date: input.due_date,
    };
    store.with(|c| tracking_repo::add_milestone(c, &draft)).and_then(to_response)
}

fn add_command(store: &MissionStore, input: CommandInput) -> MissionResult<Value> {
    let command = ProjectCommand {
        id: 0,
        label: input.label,
        command_line: input.command_line,
    };
    store.with(|c| tracking_repo::add_command(c, &input.project_id, &command)).and_then(to_response)
}

fn add_root(store: &MissionStore, path: &str) -> MissionResult<Value> {
    let trimmed = path.trim();
    if !std::path::Path::new(trimmed).is_dir() {
        return Err(MissionError::new("PATH_NOT_FOUND", format!("Dossier introuvable : {trimmed}")));
    }
    store.with(|c| tracking_repo::add_scan_root(c, trimmed))?;
    acknowledged()
}

fn by_id(
    store: &MissionStore,
    payload: &Value,
    operation: fn(&rusqlite::Connection, i64) -> MissionResult<()>,
) -> MissionResult<Value> {
    let input = parse_payload::<IdRef>(payload)?;
    store.with(|c| operation(c, input.id))?;
    acknowledged()
}
