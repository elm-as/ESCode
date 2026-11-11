use crate::mission_error::{MissionError, MissionResult};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

/// Désérialise le payload d'une commande vers son type d'entrée attendu.
/// Un payload absent (`null`) est traité comme un objet vide.
pub fn parse_payload<T: DeserializeOwned>(payload: &Value) -> MissionResult<T> {
    if payload.is_null() {
        return serde_json::from_value(Value::Object(Default::default())).map_err(MissionError::invalid_payload);
    }
    T::deserialize(payload).map_err(MissionError::invalid_payload)
}

/// Sérialise la réponse d'une commande vers JSON.
pub fn to_response<T: Serialize>(value: T) -> MissionResult<Value> {
    serde_json::to_value(value).map_err(|err| MissionError::new("SERIALIZATION_FAILURE", err.to_string()))
}

/// Réponse vide standard pour les commandes d'écriture.
pub fn acknowledged() -> MissionResult<Value> {
    Ok(serde_json::json!({ "ok": true }))
}
