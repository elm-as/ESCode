use mission_control_core::{MissionControl, MissionError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, Write};
use std::process::ExitCode;
use std::sync::{Arc, Mutex};

#[derive(Deserialize)]
struct Request {
    id: String,
    command: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Serialize)]
struct Response<'a> {
    id: &'a str,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<MissionError>,
}

/// Boucle JSON-lines : une requête par ligne sur stdin, une réponse par ligne sur stdout.
///
/// Chaque requête est traitée dans son propre thread : un scan Git de 60 dépôts ne doit pas
/// bloquer le rafraîchissement des ports. Les réponses sont corrélées par `id`, l'ordre
/// d'arrivée n'a donc pas d'importance pour l'extension.
pub fn serve(control: Arc<MissionControl>) -> ExitCode {
    let output = Arc::new(Mutex::new(std::io::stdout()));
    let stdin = std::io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else {
            break;
        };
        if line.trim().is_empty() {
            continue;
        }
        spawn_request(Arc::clone(&control), Arc::clone(&output), line);
    }
    ExitCode::SUCCESS
}

fn spawn_request(control: Arc<MissionControl>, output: Arc<Mutex<std::io::Stdout>>, line: String) {
    std::thread::spawn(move || {
        let serialized = handle_line(&control, &line);
        let Ok(mut stdout) = output.lock() else {
            return;
        };
        if writeln!(stdout, "{serialized}").and_then(|_| stdout.flush()).is_err() {
            eprintln!("elmas-mc : impossible d'écrire la réponse sur stdout");
        }
    });
}

fn handle_line(control: &MissionControl, line: &str) -> String {
    let request: Request = match serde_json::from_str(line) {
        Ok(request) => request,
        Err(err) => return encode(&failure("", MissionError::invalid_payload(err))),
    };
    let response = match control.dispatch(&request.command, request.payload) {
        Ok(data) => Response { id: &request.id, ok: true, data: Some(data), error: None },
        Err(error) => failure(&request.id, error),
    };
    encode(&response)
}

fn failure(id: &str, error: MissionError) -> Response<'_> {
    Response { id, ok: false, data: None, error: Some(error) }
}

fn encode(response: &Response) -> String {
    serde_json::to_string(response)
        .unwrap_or_else(|_| r#"{"id":"","ok":false,"error":{"code":"SERIALIZATION_FAILURE","message":""}}"#.into())
}

