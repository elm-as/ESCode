use crate::database::{DatabaseManager, DeviceProfile, RecentProject, SettingItem};
use crate::filesystem::{self, FileNode};
use crate::process_manager::{ProcessInfo, ProcessManager};
use crate::sdk_detector::{self, ToolchainStatus};
use mission_control_core::MissionControl;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, State};

pub mod mission_control_commands;

pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub process_mgr: Arc<ProcessManager>,
    pub mission_control: Arc<MissionControl>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDetectionResult {
    pub framework: String, // "react_web" | "react_native" | "flutter" | "kotlin_compose" | "unknown"
    pub entry_file: Option<String>,
    pub package_name: Option<String>,
    pub dev_script: Option<String>,
}

#[tauri::command]
pub fn fs_read_dir(path: String, max_depth: Option<usize>) -> Result<Vec<FileNode>, String> {
    filesystem::read_directory(&path, max_depth.unwrap_or(3))
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    filesystem::read_file_content(&path)
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    filesystem::write_file_content(&path, &content)
}

#[tauri::command]
pub fn fs_create_file(path: String) -> Result<(), String> {
    filesystem::create_file(&path)
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    filesystem::create_directory(&path)
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    filesystem::delete_entry(&path)
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    filesystem::rename_entry(&old_path, &new_path)
}

#[tauri::command]
pub fn fs_search_files(path: String, query: String) -> Result<Vec<filesystem::SearchResult>, String> {
    filesystem::search_in_files(&path, &query, 100)
}


#[tauri::command]
pub fn db_set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_setting(&key, &value)
}

#[tauri::command]
pub fn db_get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    state.db.get_setting(&key)
}

#[tauri::command]
pub fn db_get_all_settings(state: State<'_, AppState>) -> Result<Vec<SettingItem>, String> {
    state.db.get_all_settings()
}

#[tauri::command]
pub fn db_add_recent_project(path: String, name: String, framework: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.add_recent_project(&path, &name, &framework)
}

#[tauri::command]
pub fn db_get_recent_projects(state: State<'_, AppState>) -> Result<Vec<RecentProject>, String> {
    state.db.get_recent_projects()
}

#[tauri::command]
pub fn db_get_device_profiles(state: State<'_, AppState>) -> Result<Vec<DeviceProfile>, String> {
    state.db.get_device_profiles()
}

#[tauri::command]
pub fn sdk_scan(state: State<'_, AppState>) -> ToolchainStatus {
    let custom = sdk_detector::CustomSdkPaths {
        android_sdk: state.db.get_setting("custom_android_sdk").ok().flatten(),
        flutter_sdk: state.db.get_setting("custom_flutter_sdk").ok().flatten(),
        java_home: state.db.get_setting("custom_java_home").ok().flatten(),
        adb_path: state.db.get_setting("custom_adb_path").ok().flatten(),
    };
    sdk_detector::scan_toolchain(Some(custom))
}

#[tauri::command]
pub fn sdk_save_custom_path(key: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_setting(&key, &path)
}

#[tauri::command]
pub fn process_allocate_port() -> Result<u16, String> {
    ProcessManager::allocate_free_port()
}

#[tauri::command]
pub fn process_start(
    app: AppHandle,
    id: String,
    command_line: String,
    working_dir: String,
    env_vars: Option<HashMap<String, String>>,
    port: Option<u16>,
    state: State<'_, AppState>,
) -> Result<ProcessInfo, String> {
    state.process_mgr.start_process(
        app,
        &id,
        &command_line,
        &working_dir,
        env_vars.unwrap_or_default(),
        port,
    )
}

#[tauri::command]
pub fn process_stop(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.process_mgr.stop_process(&id)
}

#[tauri::command]
pub fn process_get_status(id: String, state: State<'_, AppState>) -> Result<Option<ProcessInfo>, String> {
    state.process_mgr.get_status(&id)
}

#[tauri::command]
pub fn detect_project_type(project_path: String) -> Result<ProjectDetectionResult, String> {
    let root = Path::new(&project_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {project_path}"));
    }

    // 1. Flutter check: pubspec.yaml
    let pubspec = root.join("pubspec.yaml");
    if pubspec.exists() {
        return Ok(ProjectDetectionResult {
            framework: "flutter".to_string(),
            entry_file: Some("lib/main.dart".to_string()),
            package_name: None,
            dev_script: Some("flutter run -d web-server".to_string()),
        });
    }

    // 2. Kotlin / Jetpack Compose: build.gradle or build.gradle.kts
    let gradle_kts = root.join("build.gradle.kts");
    let gradle = root.join("build.gradle");
    if gradle_kts.exists() || gradle.exists() {
        let is_compose = check_file_contains(&gradle_kts, "compose") || check_file_contains(&gradle, "compose");
        if is_compose {
            return Ok(ProjectDetectionResult {
                framework: "kotlin_compose".to_string(),
                entry_file: None,
                package_name: None,
                dev_script: Some("gradle run".to_string()),
            });
        }
    }

    // 3. React Native / Expo or React Web via package.json
    let pkg_json = root.join("package.json");
    if pkg_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg_json) {
            let lower = content.to_lowercase();
            if lower.contains("\"react-native\"") || lower.contains("\"expo\"") {
                return Ok(ProjectDetectionResult {
                    framework: "react_native".to_string(),
                    entry_file: Some("App.tsx".to_string()),
                    package_name: None,
                    dev_script: Some("npx expo start --web".to_string()),
                });
            }
            if lower.contains("\"react\"") || lower.contains("\"vite\"") {
                return Ok(ProjectDetectionResult {
                    framework: "react_web".to_string(),
                    entry_file: Some("src/App.tsx".to_string()),
                    package_name: None,
                    dev_script: Some("pnpm dev".to_string()),
                });
            }
        }
    }

    // 4. Vanilla Web check: index.html
    let index_html = root.join("index.html");
    if index_html.exists() {
        return Ok(ProjectDetectionResult {
            framework: "vanilla_web".to_string(),
            entry_file: Some("index.html".to_string()),
            package_name: None,
            dev_script: None,
        });
    }

    Ok(ProjectDetectionResult {
        framework: "unknown".to_string(),
        entry_file: None,
        package_name: None,
        dev_script: None,
    })
}

fn check_file_contains(path: &Path, pattern: &str) -> bool {
    if !path.exists() {
        return false;
    }
    std::fs::read_to_string(path)
        .map(|c| c.to_lowercase().contains(pattern))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_react_web_project() {
        let manifest = detect_project_type("../test-projects/react-web-mobile".to_string())
            .expect("detect project failed");
        assert_eq!(manifest.framework, "react_web");
        assert_eq!(manifest.entry_file, Some("src/App.tsx".to_string()));
    }

    #[test]
    fn test_detect_react_native_project() {
        let manifest = detect_project_type("../test-projects/react-native-mobile".to_string())
            .expect("detect RN project failed");
        assert_eq!(manifest.framework, "react_native");
        assert_eq!(manifest.entry_file, Some("App.tsx".to_string()));
    }

    #[test]
    fn test_detect_flutter_project() {
        let manifest = detect_project_type("../test-projects/flutter-mobile".to_string())
            .expect("detect Flutter project failed");
        assert_eq!(manifest.framework, "flutter");
        assert_eq!(manifest.entry_file, Some("lib/main.dart".to_string()));
    }

    #[test]
    fn test_detect_kotlin_compose_project() {
        let manifest = detect_project_type("../test-projects/kotlin-compose-mobile".to_string())
            .expect("detect Kotlin project failed");
        assert_eq!(manifest.framework, "kotlin_compose");
    }

    #[test]
    fn test_detect_vanilla_web_project() {
        let manifest = detect_project_type("../test-projects/vanilla-html-mobile".to_string())
            .expect("detect vanilla web project failed");
        assert_eq!(manifest.framework, "vanilla_web");
        assert_eq!(manifest.entry_file, Some("index.html".to_string()));
    }
}


