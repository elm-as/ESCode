use crate::command_payload::to_response;
use crate::mission_error::MissionResult;
use crate::projects::project_catalog;
use crate::storage::connection::{unix_now, MissionStore};
use serde::Serialize;
use serde_json::Value;
use sysinfo::{Disks, ProcessesToUpdate, System};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub sampled_at: i64,
    pub cpu_usage_percent: f32,
    pub cpu_core_count: usize,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
    pub disks: Vec<DiskTelemetry>,
    pub top_processes: Vec<ProcessTelemetry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskTelemetry {
    pub name: String,
    pub mount_point: String,
    pub available_bytes: u64,
    pub total_bytes: u64,
    pub used_percent: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTelemetry {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub project_name: Option<String>,
}

pub fn handle(store: &MissionStore, command: &str, _payload: &Value) -> Option<MissionResult<Value>> {
    match command {
        "system.sample" => Some(sample_system(store).and_then(to_response)),
        _ => None,
    }
}

pub fn sample_system(store: &MissionStore) -> MissionResult<SystemSnapshot> {
    let mut sys = System::new_all()
        .map_err(|e| crate::mission_error::MissionError::new("SYSINFO_ERROR", e.to_string()))?;
    std::thread::sleep(std::time::Duration::from_millis(120));
    let _ = sys.refresh_cpu_all();
    let _ = sys.refresh_memory();
    let _ = sys.refresh_processes(ProcessesToUpdate::All, true);

    let projects = project_catalog::cached_catalog(store).unwrap_or_default();
    let disks = collect_disks();
    let top_processes = collect_top_processes(&sys, &projects);

    Ok(SystemSnapshot {
        sampled_at: unix_now(),
        cpu_usage_percent: (sys.global_cpu_usage() * 10.0).round() / 10.0,
        cpu_core_count: sys.cpus().len(),
        ram_used_bytes: sys.used_memory(),
        ram_total_bytes: sys.total_memory(),
        swap_used_bytes: sys.used_swap(),
        swap_total_bytes: sys.total_swap(),
        disks,
        top_processes,
    })
}

fn collect_disks() -> Vec<DiskTelemetry> {
    let Ok(disks) = Disks::new_with_refreshed_list() else {
        return Vec::new();
    };
    disks
        .iter()
        .filter(|disk| disk.total_space() > 0)
        .map(|disk| {
            let total = disk.total_space();
            let avail = disk.available_space();
            let used = total.saturating_sub(avail);
            let pct = ((used as f64 / total as f64) * 1000.0).round() as f32 / 10.0;
            DiskTelemetry {
                name: disk.name().to_string_lossy().into_owned(),
                mount_point: disk.mount_point().to_string_lossy().into_owned(),
                available_bytes: avail,
                total_bytes: total,
                used_percent: pct,
            }
        })
        .collect()
}

fn collect_top_processes(
    sys: &System,
    projects: &[crate::projects::project_model::ProjectSummary],
) -> Vec<ProcessTelemetry> {
    let core_count = sys.cpus().len().max(1) as f32;
    let mut list: Vec<ProcessTelemetry> = sys
        .processes()
        .values()
        .map(|proc_info| {
            let cwd = proc_info.cwd().map(|p| p.to_string_lossy().into_owned());
            let project_name = match_project_name(cwd.as_deref(), projects);
            ProcessTelemetry {
                pid: proc_info.pid().as_u32(),
                name: proc_info.name().to_string_lossy().into_owned(),
                cpu_percent: ((proc_info.cpu_usage() / core_count) * 10.0).round() / 10.0,
                memory_bytes: proc_info.memory(),
                project_name,
            }
        })
        .collect();

    list.sort_by(|a, b| {
        b.project_name
            .is_some()
            .cmp(&a.project_name.is_some())
            .then_with(|| b.memory_bytes.cmp(&a.memory_bytes))
    });
    list.truncate(12);
    list
}

fn match_project_name(
    cwd: Option<&str>,
    projects: &[crate::projects::project_model::ProjectSummary],
) -> Option<String> {
    let cwd_norm = cwd?.replace('\\', "/").to_lowercase();
    projects
        .iter()
        .find(|p| {
            let proj_norm = p.path.replace('\\', "/").to_lowercase();
            cwd_norm == proj_norm || cwd_norm.starts_with(&format!("{proj_norm}/"))
        })
        .map(|p| p.name.clone())
}
