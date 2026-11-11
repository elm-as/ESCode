//! Elmas Mission Control — cœur métier partagé du tableau de bord ESCode.

pub mod command_payload;
pub mod command_runner;
pub mod disk;
pub mod dispatch;
pub mod env_vault;
pub mod git;
pub mod mission_error;
pub mod ports;
pub mod projects;
pub mod scripts;
pub mod sessions;
pub mod storage;
pub mod system;

pub use dispatch::MissionControl;
pub use mission_error::{MissionError, MissionResult};
