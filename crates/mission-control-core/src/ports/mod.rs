use crate::command_payload::{acknowledged, parse_payload, to_response};
use crate::command_runner::{run_tool, ToolInvocation};
use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_catalog;
use crate::storage::connection::MissionStore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivePortEntry {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub local_address: String,
    pub is_dev_port: bool,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanPortsInput {
    #[serde(default)]
    dev_only: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillPortInput {
    pid: u32,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "ports.scan" => parse_payload::<ScanPortsInput>(payload)
            .and_then(|input| scan_active_ports(store, input.dev_only))
            .and_then(to_response),
        "ports.kill" => parse_payload::<KillPortInput>(payload)
            .and_then(|input| kill_process_tree(input.pid))
            .and_then(|_| acknowledged()),
        _ => return None,
    };
    Some(result)
}

pub fn scan_active_ports(store: &MissionStore, dev_only: bool) -> MissionResult<Vec<ActivePortEntry>> {
    let netstat = run_tool(&ToolInvocation {
        program: "netstat",
        args: &["-ano", "-p", "tcp"],
        working_dir: None,
    })?;
    let raw_listeners = parse_netstat_listeners(&netstat.stdout);
    let projects = project_catalog::cached_catalog(store).unwrap_or_default();

    let mut sys = System::new().map_err(|e| MissionError::new("SYSINFO_ERROR", e.to_string()))?;
    let _ = sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut seen_ports = HashMap::new();
    for (local_addr, port, pid) in raw_listeners {
        if pid == 0 || seen_ports.contains_key(&port) {
            continue;
        }
        let (process_name, cwd) = resolve_process_details(&sys, pid);
        let is_dev = is_likely_dev_port(port, &process_name);
        if dev_only && !is_dev {
            continue;
        }
        let matched_project = match_project_by_cwd(cwd.as_deref(), &projects);
        seen_ports.insert(
            port,
            ActivePortEntry {
                port,
                pid,
                process_name,
                local_address: local_addr,
                is_dev_port: is_dev,
                project_id: matched_project.as_ref().map(|(id, _)| id.clone()),
                project_name: matched_project.map(|(_, name)| name),
            },
        );
    }

    let mut entries: Vec<ActivePortEntry> = seen_ports.into_values().collect();
    entries.sort_by_key(|entry| (!entry.is_dev_port, entry.port));
    Ok(entries)
}

fn resolve_process_details(sys: &System, pid: u32) -> (String, Option<String>) {
    let Some(proc_info) = sys.process(Pid::from_u32(pid)) else {
        return (format!("PID {pid}"), None);
    };
    let name = proc_info.name().to_string_lossy().into_owned();
    let cwd = proc_info.cwd().map(|path| path.to_string_lossy().into_owned());
    (name, cwd)
}

fn match_project_by_cwd(
    cwd: Option<&str>,
    projects: &[crate::projects::project_model::ProjectSummary],
) -> Option<(String, String)> {
    let cwd_norm = cwd?.replace('\\', "/").to_lowercase();
    projects
        .iter()
        .find(|project| {
            let proj_norm = project.path.replace('\\', "/").to_lowercase();
            cwd_norm == proj_norm || cwd_norm.starts_with(&format!("{proj_norm}/"))
        })
        .map(|project| (project.id.clone(), project.name.clone()))
}

/// Ports usuels des serveurs de développement ou processus appartenant aux runtimes dev.
pub fn is_likely_dev_port(port: u16, process_name: &str) -> bool {
    let lower = process_name.to_lowercase();
    let is_dev_runtime = [
        "node", "deno", "bun", "cargo", "rust", "python", "uvicorn", "flask", "dart", "flutter",
        "java", "gradle", "kotlin", "php", "ruby", "go", "elmas", "vite",
    ]
    .iter()
    .any(|runtime| lower.contains(runtime));

    if is_dev_runtime && port >= 1024 {
        return true;
    }
    matches!(
        port,
        1420..=1430
            | 3000..=3100
            | 4000..=4300
            | 5000..=5999
            | 6006
            | 7000..=7999
            | 8000..=8999
            | 9000..=9999
            | 19000..=19006
    )
}

/// Fonction pure : extrait `(adresse_locale, port, pid)` depuis la sortie de `netstat -ano -p tcp`.
/// Compatible avec les Windows en français (`LISTENING` / `ÉCOUTE`) et en anglais.
pub fn parse_netstat_listeners(stdout: &str) -> Vec<(String, u16, u32)> {
    let mut results = Vec::new();
    for line in stdout.lines() {
        let columns: Vec<&str> = line.split_whitespace().collect();
        if columns.len() < 5 {
            continue;
        }
        if !columns[0].eq_ignore_ascii_case("TCP") {
            continue;
        }
        let state = columns[3].to_uppercase();
        if !state.contains("LISTEN") && !state.contains("COUTE") {
            continue;
        }
        let Some((addr, port)) = split_host_port(columns[1]) else {
            continue;
        };
        let Ok(pid) = columns[4].parse::<u32>() else {
            continue;
        };
        results.push((addr, port, pid));
    }
    results
}

fn split_host_port(endpoint: &str) -> Option<(String, u16)> {
    let (host, port_str) = endpoint.rsplit_once(':')?;
    let port = port_str.parse::<u16>().ok()?;
    Some((host.to_string(), port))
}

/// Termine l'arbre de processus complet d'un PID (Windows `taskkill /F /T` ou Unix `kill -9`).
pub fn kill_process_tree(pid: u32) -> MissionResult<()> {
    if pid <= 4 {
        return Err(MissionError::invalid_payload("Impossible d'arrêter un processus système critique"));
    }
    let pid_text = pid.to_string();
    #[cfg(windows)]
    let invocation = ToolInvocation {
        program: "taskkill",
        args: &["/F", "/T", "/PID", &pid_text],
        working_dir: None,
    };
    #[cfg(not(windows))]
    let invocation = ToolInvocation {
        program: "kill",
        args: &["-9", &pid_text],
        working_dir: None,
    };
    let output = run_tool(&invocation)?;
    if !output.success {
        return Err(MissionError::new(
            "KILL_FAILED",
            format!("Échec de l'arrêt du PID {pid} : {}", output.stderr.trim()),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_french_and_english_netstat_lines() {
        let sample = r#"
Proto  Adresse locale         Adresse distante       État            PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1140
  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       24120
  TCP    [::1]:8080             [::]:0                 ÉCOUTE          9920
  TCP    127.0.0.1:5173         127.0.0.1:54112        ESTABLISHED     24120
"#;
        let parsed = parse_netstat_listeners(sample);
        assert_eq!(parsed.len(), 3);
        assert_eq!(parsed[1], ("127.0.0.1".to_string(), 5173, 24120));
        assert_eq!(parsed[2], ("[::1]".to_string(), 8080, 9920));
    }
}
