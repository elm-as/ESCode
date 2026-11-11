use crate::projects::stack_detection::{detect_stack, StackDetection};
use std::fs;
use std::path::{Path, PathBuf};

/// Projet trouvé sur disque, avant fusion avec les métadonnées de suivi en base.
#[derive(Debug, Clone)]
pub struct DiscoveredProject {
    pub id: String,
    pub path: String,
    pub name: String,
    pub detection: StackDetection,
    pub has_git: bool,
    pub modified_at: i64,
}

/// Dossiers jamais considérés comme des projets, même s'ils sont à la racine d'un scan.
const EXCLUDED_FOLDER_NAMES: &[&str] = &["node_modules", "$RECYCLE.BIN", "System Volume Information"];

/// Liste les projets d'une racine de scan : chaque sous-dossier direct est un projet.
pub fn discover_root(root: &Path) -> Vec<DiscoveredProject> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && !is_excluded_folder(path))
        .map(|path| inspect_project(&path))
        .collect()
}

/// Inspecte un dossier unique (racine de scan ou projet ajouté manuellement).
pub fn inspect_project(path: &Path) -> DiscoveredProject {
    let normalized = normalize_project_path(path);
    DiscoveredProject {
        id: project_id_for_path(&normalized),
        name: folder_name(path),
        detection: detect_stack(path),
        has_git: path.join(".git").exists(),
        modified_at: modified_unix_seconds(path),
        path: normalized,
    }
}

fn is_excluded_folder(path: &Path) -> bool {
    let name = folder_name(path);
    name.starts_with('.') || EXCLUDED_FOLDER_NAMES.contains(&name.as_str())
}

fn folder_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn modified_unix_seconds(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

/// Chemin canonique d'affichage : séparateurs natifs, sans séparateur final.
pub fn normalize_project_path(path: &Path) -> String {
    let as_text = PathBuf::from(path).to_string_lossy().into_owned();
    as_text.trim_end_matches(['/', '\\']).to_string()
}

/// Identifiant stable d'un projet : empreinte FNV-1a 64 bits du chemin normalisé,
/// insensible à la casse et au type de séparateur (Windows ne distingue ni l'un ni l'autre).
pub fn project_id_for_path(path: &str) -> String {
    const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;
    let canonical = path.replace('\\', "/").to_lowercase();
    let hash = canonical
        .bytes()
        .fold(FNV_OFFSET, |acc, byte| (acc ^ byte as u64).wrapping_mul(FNV_PRIME));
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_id_ignores_case_and_separators() {
        let a = project_id_for_path("C:\\Users\\elmas\\Desktop\\Projets\\Kiln");
        let b = project_id_for_path("c:/users/elmas/desktop/projets/kiln");
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
    }

    #[test]
    fn discovers_sample_projects_and_skips_hidden_folders() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test-projects");
        let found = discover_root(&root);
        assert_eq!(found.len(), 5);
        assert!(found.iter().all(|project| !project.name.starts_with('.')));
    }
}

