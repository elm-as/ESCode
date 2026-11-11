use crate::commands::AppState;
use serde_json::Value;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn mc_dispatch(
    command: String,
    payload: Option<Value>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    state
        .mission_control
        .dispatch(&command, payload.unwrap_or(Value::Null))
        .map_err(|err| err.message)
}

#[tauri::command]
pub fn mc_host_action(
    action: String,
    payload: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    match action.as_str() {
        "openProject" | "runPreview" => {
            let path = payload
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Missing 'path' in host action".to_string())?;
            let _ = state.mission_control.dispatch(
                "sessions.start",
                serde_json::json!({ "path": path }),
            );
            launch_elmas_studio_ide(path)
        }
        "openTerminal" => {
            let path = payload
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Missing 'path' in host action".to_string())?;
            open_external_terminal(path, None)
        }
        "runCommandInTerminal" => {
            let path = payload
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Missing 'path' in host action".to_string())?;
            let cmd = payload
                .get("command")
                .and_then(Value::as_str)
                .unwrap_or("");
            open_external_terminal(path, Some(cmd))
        }
        "openExternalUrl" | "openInSimulator" => {
            let url = payload
                .get("url")
                .and_then(Value::as_str)
                .ok_or_else(|| "Missing 'url' in host action".to_string())?;
            std::process::Command::new("cmd")
                .args(["/C", "start", "", url])
                .spawn()
                .map_err(|e| format!("Failed to open URL: {e}"))?;
            Ok(())
        }
        _ => Err(format!("Unsupported host action: {action}")),
    }
}

fn launch_elmas_studio_ide(project_path: &str) -> Result<(), String> {
    let candidates = [
        r"C:\Users\elmas\Desktop\Projets\ESCode\Elmas-Studio-Desktop\Elmas Studio.exe",
        r".\Elmas-Studio-Desktop\Elmas Studio.exe",
        r"..\Elmas-Studio-Desktop\Elmas Studio.exe",
    ];
    for candidate in candidates {
        let exe = Path::new(candidate);
        if exe.exists() {
            std::process::Command::new(exe)
                .arg(project_path)
                .spawn()
                .map_err(|e| format!("Failed to launch Elmas Studio.exe: {e}"))?;
            return Ok(());
        }
    }
    std::process::Command::new("cmd")
        .args(["/C", "code", project_path])
        .spawn()
        .map_err(|e| format!("Failed to launch IDE for {project_path}: {e}"))?;
    Ok(())
}

fn open_external_terminal(project_path: &str, command: Option<&str>) -> Result<(), String> {
    if let Some(cmd_str) = command.filter(|s| !s.trim().is_empty()) {
        std::process::Command::new("cmd")
            .args([
                "/C",
                "start",
                "powershell",
                "-NoExit",
                "-Command",
                &format!("Set-Location -LiteralPath '{project_path}'; {cmd_str}"),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch terminal command: {e}"))?;
        return Ok(());
    }

    let wt_attempt = std::process::Command::new("wt.exe")
        .args(["-d", project_path])
        .spawn();
    if wt_attempt.is_ok() {
        return Ok(());
    }

    std::process::Command::new("cmd")
        .args([
            "/C",
            "start",
            "powershell",
            "-NoExit",
            "-Command",
            &format!("Set-Location -LiteralPath '{project_path}'"),
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch terminal: {e}"))?;
    Ok(())
}

