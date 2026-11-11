pub mod commands;
pub mod database;
pub mod filesystem;
pub mod process_manager;
pub mod sdk_detector;

use commands::AppState;
use database::DatabaseManager;
use mission_control_core::MissionControl;
use process_manager::ProcessManager;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_mgr = Arc::new(ProcessManager::new());
    let process_mgr_exit = process_mgr.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            if !app_data_dir.exists() {
                let _ = std::fs::create_dir_all(&app_data_dir);
            }

            let db_path = app_data_dir.join("elmas_studio.db");
            let db = DatabaseManager::new(&db_path)
                .unwrap_or_else(|_| DatabaseManager::new_in_memory().expect("in-memory db failed"));
            let mission_control = MissionControl::open(&db_path)
                .unwrap_or_else(|_| MissionControl::open_in_memory().expect("in-memory mc failed"));

            let app_state = AppState {
                db: Arc::new(db),
                process_mgr: process_mgr.clone(),
                mission_control: Arc::new(mission_control),
            };

            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs_read_dir,
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_create_file,
            commands::fs_create_dir,
            commands::fs_delete,
            commands::fs_rename,
            commands::db_set_setting,
            commands::db_get_setting,
            commands::db_get_all_settings,
            commands::db_add_recent_project,
            commands::db_get_recent_projects,
            commands::db_get_device_profiles,
            commands::sdk_scan,
            commands::sdk_save_custom_path,
            commands::process_allocate_port,
            commands::process_start,
            commands::process_stop,
            commands::process_get_status,
            commands::fs_search_files,
            commands::detect_project_type,
            commands::mission_control_commands::mc_dispatch,
            commands::mission_control_commands::mc_host_action,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                process_mgr_exit.stop_all();
            }
        });
}
