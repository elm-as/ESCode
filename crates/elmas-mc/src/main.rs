mod jsonl_server;

use mission_control_core::MissionControl;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;

/// Identifiant Tauri de l'app (`tauri.conf.json`) : l'extension et l'app Tauri partagent
/// ainsi le même fichier SQLite, donc les mêmes données de suivi.
const TAURI_APP_IDENTIFIER: &str = "com.elmascore.studio";
const USAGE: &str = "Usage :\n  elmas-mc serve [--db <chemin>]\n  elmas-mc call <commande> [payload-json] [--db <chemin>]";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let database_path = read_flag(&args, "--db").map(PathBuf::from).unwrap_or_else(default_database_path);
    let positional: Vec<&str> = positional_args(&args);

    let Some(mode) = positional.first().copied() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };

    let control = match open_control(&database_path) {
        Ok(control) => control,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    match mode {
        "serve" => jsonl_server::serve(Arc::new(control)),
        "call" => run_single_call(&control, &positional[1..]),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn open_control(database_path: &PathBuf) -> Result<MissionControl, String> {
    if let Some(parent) = database_path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| format!("Dossier de données inaccessible : {err}"))?;
    }
    MissionControl::open(database_path).map_err(|err| err.to_string())
}

/// Mode de diagnostic : exécute une commande et imprime la réponse JSON indentée.
fn run_single_call(control: &MissionControl, args: &[&str]) -> ExitCode {
    let Some(command) = args.first() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let payload = match args.get(1).map(|raw| serde_json::from_str(raw)).transpose() {
        Ok(value) => value.unwrap_or(serde_json::Value::Null),
        Err(err) => {
            eprintln!("Payload JSON invalide : {err}");
            return ExitCode::from(2);
        }
    };
    match control.dispatch(command, payload) {
        Ok(data) => {
            println!("{}", serde_json::to_string_pretty(&data).unwrap_or_default());
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

fn default_database_path() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("XDG_DATA_HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(TAURI_APP_IDENTIFIER).join("elmas_studio.db")
}

fn read_flag(args: &[String], flag: &str) -> Option<String> {
    let position = args.iter().position(|arg| arg == flag)?;
    args.get(position + 1).cloned()
}

fn positional_args(args: &[String]) -> Vec<&str> {
    let mut positional = Vec::new();
    let mut skip_next = false;
    for arg in args {
        if skip_next {
            skip_next = false;
            continue;
        }
        if arg.starts_with("--") {
            skip_next = true;
            continue;
        }
        positional.push(arg.as_str());
    }
    positional
}

