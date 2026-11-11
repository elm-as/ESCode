use serde::Serialize;
use std::fs;
use std::path::Path;

/// Résultat de la détection : la stack principale du projet et, s'il y en a une,
/// la bibliothèque d'interface web utilisée (utile pour l'aperçu mobile de l'IDE).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StackDetection {
    pub stack: String,
    pub ui_framework: Option<String>,
}

/// Détecte la stack d'un dossier projet à partir de ses fichiers marqueurs de premier niveau.
///
/// L'ordre des tests est significatif : un projet Tauri contient aussi un `package.json`,
/// un projet Flutter peut contenir un `index.html` (web/) — le marqueur le plus spécifique gagne.
pub fn detect_stack(root: &Path) -> StackDetection {
    let package_json = read_lowercase(&root.join("package.json"));
    let ui_framework = package_json.as_deref().and_then(detect_ui_framework);
    let stack = detect_primary_stack(root, package_json.as_deref());
    StackDetection { stack: stack.to_string(), ui_framework }
}

fn detect_primary_stack(root: &Path, package_json: Option<&str>) -> &'static str {
    if root.join("pubspec.yaml").exists() {
        return "flutter";
    }
    if root.join("src-tauri").join("tauri.conf.json").exists() {
        return "tauri";
    }
    if let Some(gradle_stack) = detect_gradle_stack(root) {
        return gradle_stack;
    }
    if let Some(package) = package_json {
        return detect_node_stack(package);
    }
    detect_from_markers(root)
}

fn detect_gradle_stack(root: &Path) -> Option<&'static str> {
    let candidates = ["build.gradle.kts", "build.gradle"];
    let content: String = candidates
        .iter()
        .filter_map(|name| read_lowercase(&root.join(name)))
        .collect();
    if content.is_empty() {
        return None;
    }
    if content.contains("compose") {
        return Some("kotlin_compose");
    }
    Some("jvm")
}

fn detect_node_stack(package: &str) -> &'static str {
    let has = |dependency: &str| package.contains(&format!("\"{dependency}\""));
    if has("react-native") || has("expo") {
        return "react_native";
    }
    if has("next") {
        return "nextjs";
    }
    if has("electron") {
        return "electron";
    }
    if has("react") || has("vite") {
        return "react_web";
    }
    if has("vue") {
        return "vue";
    }
    if has("svelte") {
        return "svelte";
    }
    "node"
}

fn detect_ui_framework(package: &str) -> Option<String> {
    ["react", "vue", "svelte", "solid-js", "@angular/core"]
        .iter()
        .find(|name| package.contains(&format!("\"{name}\"")))
        .map(|name| name.to_string())
}

/// Marqueurs sans gestionnaire de paquets JS. Les tests d'extensions de fichiers ne portent
/// que sur le premier niveau pour rester rapides sur 60+ projets.
fn detect_from_markers(root: &Path) -> &'static str {
    const FILE_MARKERS: &[(&str, &str)] = &[
        ("Cargo.toml", "rust"),
        ("project.godot", "godot"),
        ("go.mod", "go"),
        ("pyproject.toml", "python"),
        ("requirements.txt", "python"),
        ("CMakeLists.txt", "c_cpp"),
        ("composer.json", "php"),
        ("index.html", "vanilla_web"),
    ];
    if let Some((_, stack)) = FILE_MARKERS.iter().find(|(file, _)| root.join(file).exists()) {
        return stack;
    }
    detect_from_extensions(root)
}

fn detect_from_extensions(root: &Path) -> &'static str {
    const EXTENSION_MARKERS: &[(&str, &str)] = &[
        ("py", "python"),
        ("ipynb", "python"),
        ("tex", "latex"),
        ("c", "c_cpp"),
        ("cpp", "c_cpp"),
        ("java", "jvm"),
        ("html", "vanilla_web"),
        ("r", "r"),
    ];
    let extensions = first_level_extensions(root);
    EXTENSION_MARKERS
        .iter()
        .find(|(ext, _)| extensions.iter().any(|found| found == ext))
        .map(|(_, stack)| *stack)
        .unwrap_or("unknown")
}

fn first_level_extensions(root: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext.to_string_lossy().to_lowercase())
        })
        .collect()
}

fn read_lowercase(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|content| content.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn sample(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test-projects").join(name)
    }

    #[test]
    fn detects_every_sample_project() {
        let cases = [
            ("react-web-mobile", "react_web"),
            ("react-native-mobile", "react_native"),
            ("flutter-mobile", "flutter"),
            ("kotlin-compose-mobile", "kotlin_compose"),
            ("vanilla-html-mobile", "vanilla_web"),
        ];
        for (folder, expected) in cases {
            assert_eq!(detect_stack(&sample(folder)).stack, expected, "{folder}");
        }
    }

    #[test]
    fn escode_itself_is_a_tauri_project_with_react_ui() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        let detection = detect_stack(&root);
        assert_eq!(detection.stack, "tauri");
        assert_eq!(detection.ui_framework.as_deref(), Some("react"));
    }
}

