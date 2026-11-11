use serde::Serialize;
use std::fmt;

/// Erreur métier typée renvoyée à l'UI. Le `code` est stable (l'UI peut s'y fier),
/// le `message` est destiné à l'humain.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MissionError {
    pub code: String,
    pub message: String,
}

impl MissionError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    pub fn storage(err: impl fmt::Display) -> Self {
        Self::new("STORAGE_FAILURE", err.to_string())
    }

    pub fn invalid_payload(err: impl fmt::Display) -> Self {
        Self::new("INVALID_PAYLOAD", err.to_string())
    }

    pub fn not_found(what: &str) -> Self {
        Self::new("NOT_FOUND", format!("{what} introuvable"))
    }
}

impl fmt::Display for MissionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for MissionError {}

impl From<rusqlite::Error> for MissionError {
    fn from(err: rusqlite::Error) -> Self {
        Self::storage(err)
    }
}

pub type MissionResult<T> = Result<T, MissionError>;

