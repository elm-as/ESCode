use crate::mission_error::{MissionError, MissionResult};
use crate::projects::discovery::{discover_root, inspect_project, DiscoveredProject};
use crate::projects::project_model::{ProjectDetail, ProjectSummary};
use crate::storage::connection::MissionStore;
use crate::storage::{projects_repo, tracking_repo};
use std::path::{Path, PathBuf};

/// Dossier racine proposé au premier lancement : là où vivent les projets d'Elmas.
pub fn default_scan_root() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    let candidate = PathBuf::from(home).join("Desktop").join("Projets");
    candidate.is_dir().then_some(candidate)
}

pub fn seed_default_root(store: &MissionStore) -> MissionResult<()> {
    let Some(root) = default_scan_root() else {
        return Ok(());
    };
    let connection = store.lock()?;
    tracking_repo::add_scan_root(&connection, &root.to_string_lossy())
}

/// Rescanne les racines et les projets manuels, met la base à jour, puis renvoie le catalogue.
pub fn refresh_catalog(store: &MissionStore) -> MissionResult<Vec<ProjectSummary>> {
    let (mut roots, manual_paths) = {
        let connection = store.lock()?;
        (
            tracking_repo::list_scan_roots(&connection)?,
            projects_repo::manual_project_paths(&connection)?,
        )
    };
    if roots.is_empty() && manual_paths.is_empty() {
        seed_default_root(store)?;
        let connection = store.lock()?;
        roots = tracking_repo::list_scan_roots(&connection)?;
    }
    let discovered = discover_all(&roots, &manual_paths);
    let mut connection = store.lock()?;
    let scan_time = projects_repo::upsert_discovered(&mut connection, &discovered)?;
    projects_repo::list_summaries(&connection, scan_time)
}

/// Catalogue tel qu'en base, sans rescanner le disque (lecture rapide pour l'accueil).
pub fn cached_catalog(store: &MissionStore) -> MissionResult<Vec<ProjectSummary>> {
    let connection = store.lock()?;
    projects_repo::list_summaries(&connection, 0)
}

fn discover_all(roots: &[String], manual_paths: &[String]) -> Vec<DiscoveredProject> {
    let from_roots = roots.iter().flat_map(|root| discover_root(Path::new(root)));
    let manual = manual_paths
        .iter()
        .map(Path::new)
        .filter(|path| path.is_dir())
        .map(inspect_project);
    from_roots.chain(manual).collect()
}

pub fn project_detail(store: &MissionStore, project_id: &str) -> MissionResult<ProjectDetail> {
    let connection = store.lock()?;
    let summary = projects_repo::find_summary(&connection, project_id)?;
    let (notes_md, netlify_site_id) = projects_repo::read_notes(&connection, project_id)?;
    Ok(ProjectDetail {
        summary,
        notes_md,
        netlify_site_id,
        tasks: tracking_repo::list_tasks(&connection, project_id)?,
        milestones: tracking_repo::list_milestones(&connection, project_id)?,
        commands: tracking_repo::list_commands(&connection, project_id)?,
    })
}

/// Épingle au recueil un dossier situé hors des racines de scan.
pub fn add_manual_project(store: &MissionStore, path: &str) -> MissionResult<ProjectSummary> {
    let folder = Path::new(path.trim());
    if !folder.is_dir() {
        return Err(MissionError::new("PATH_NOT_FOUND", format!("Dossier introuvable : {path}")));
    }
    let discovered = inspect_project(folder);
    let mut connection = store.lock()?;
    projects_repo::upsert_discovered(&mut connection, std::slice::from_ref(&discovered))?;
    projects_repo::mark_manual(&connection, &discovered.id)?;
    projects_repo::find_summary(&connection, &discovered.id)
}

/// Résout le chemin disque d'un projet suivi (utilisé par Git, disque, scripts…).
pub fn project_path(store: &MissionStore, project_id: &str) -> MissionResult<PathBuf> {
    let connection = store.lock()?;
    let summary = projects_repo::find_summary(&connection, project_id)?;
    Ok(PathBuf::from(summary.path))
}

