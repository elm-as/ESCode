use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub children: Option<Vec<FileNode>>,
}

/// Lists entries in a directory recursively up to a bounded depth.
pub fn read_directory(dir_path: &str, max_depth: usize) -> Result<Vec<FileNode>, String> {
    let path = Path::new(dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {dir_path}"));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {dir_path}"));
    }

    read_dir_recursive(path, 0, max_depth)
}

fn read_dir_recursive(path: &Path, current_depth: usize, max_depth: usize) -> Result<Vec<FileNode>, String> {
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip heavy directories to preserve memory and performance
        if is_ignored_directory(&name) {
            continue;
        }

        let is_dir = entry_path.is_dir();
        let size = if is_dir { None } else { entry.metadata().ok().map(|m| m.len()) };

        let children = if is_dir && current_depth < max_depth {
            Some(read_dir_recursive(&entry_path, current_depth + 1, max_depth)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            size,
            children,
        });
    }

    // Sort: directories first, then alphabetical
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

fn is_ignored_directory(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | ".dart_tool" | ".gradle" | "build" | ".idea" | ".vscode" | "dist"
    )
}

pub fn read_file_content(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File not found: {file_path}"));
    }
    if path.is_dir() {
        return Err(format!("Cannot read directory as file: {file_path}"));
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))
}

pub fn write_file_content(file_path: &str, content: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file: {e}"))
}

pub fn create_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if path.exists() {
        return Err(format!("File already exists: {file_path}"));
    }
    write_file_content(file_path, "")
}

pub fn create_directory(dir_path: &str) -> Result<(), String> {
    let path = Path::new(dir_path);
    if path.exists() {
        return Err(format!("Directory already exists: {dir_path}"));
    }
    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {e}"))
}

pub fn delete_entry(target_path: &str) -> Result<(), String> {
    let path = Path::new(target_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {target_path}"));
    }

    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete directory: {e}"))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {e}"))
    }
}

pub fn rename_entry(old_path: &str, new_path: &str) -> Result<(), String> {
    let source = Path::new(old_path);
    let dest = Path::new(new_path);
    if !source.exists() {
        return Err(format!("Source path does not exist: {old_path}"));
    }
    if dest.exists() {
        return Err(format!("Destination path already exists: {new_path}"));
    }
    fs::rename(source, dest).map_err(|e| format!("Failed to rename entry: {e}"))
}

