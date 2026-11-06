use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolItem {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub required_for: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolchainStatus {
    pub tools: Vec<ToolItem>,
    pub android_sdk_path: Option<String>,
    pub flutter_sdk_path: Option<String>,
    pub java_home: Option<String>,
}

pub fn scan_toolchain() -> ToolchainStatus {
    let mut tools = Vec::new();

    // 1. Node.js
    tools.push(detect_cli_tool("node", "Node.js", &["--version"], vec!["React Web", "React Native"]));

    // 2. npm & pnpm
    tools.push(detect_cli_tool("npm", "npm", &["--version"], vec!["React Web", "React Native"]));
    tools.push(detect_cli_tool("pnpm", "pnpm", &["--version"], vec!["React Web", "React Native"]));

    // 3. Flutter & Dart
    let flutter_tool = detect_flutter_tool();
    let flutter_path = flutter_tool.path.clone();
    tools.push(flutter_tool);
    tools.push(detect_cli_tool("dart", "Dart", &["--version"], vec!["Flutter"]));

    // 4. Java JDK
    tools.push(detect_java_tool());

    // 5. Gradle
    tools.push(detect_cli_tool("gradle", "Gradle", &["-v"], vec!["Kotlin / Android"]));

    // 6. Android SDK & ADB
    let (android_sdk_path, adb_tool) = detect_android_sdk_and_adb();
    tools.push(adb_tool);

    ToolchainStatus {
        tools,
        android_sdk_path,
        flutter_sdk_path: flutter_path,
        java_home: std::env::var("JAVA_HOME").ok(),
    }
}

fn detect_cli_tool(binary: &str, display_name: &str, args: &[&str], required_for: Vec<&str>) -> ToolItem {
    let which_res = which::which(binary);
    let installed_path = match which_res {
        Ok(p) => Some(p.to_string_lossy().to_string()),
        Err(_) => None,
    };

    if installed_path.is_none() {
        return ToolItem {
            name: display_name.to_string(),
            installed: false,
            version: None,
            path: None,
            required_for: required_for.into_iter().map(String::from).collect(),
        };
    }

    let version = run_command_for_version(binary, args);

    ToolItem {
        name: display_name.to_string(),
        installed: true,
        version,
        path: installed_path,
        required_for: required_for.into_iter().map(String::from).collect(),
    }
}

fn detect_flutter_tool() -> ToolItem {
    let flutter_in_path = which::which("flutter");
    let mut resolved_path = flutter_in_path.ok().map(|p| p.to_string_lossy().to_string());

    // Check standard Windows Flutter directory if not in PATH
    if resolved_path.is_none() {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let candidate = PathBuf::from(userprofile).join("Documents").join("Flutter SDK").join("flutter").join("bin").join("flutter.bat");
            if candidate.exists() {
                resolved_path = Some(candidate.to_string_lossy().to_string());
            }
        }
    }

    if let Some(ref path_str) = resolved_path {
        let version = run_command_for_version(path_str, &["--version"]);
        return ToolItem {
            name: "Flutter".to_string(),
            installed: true,
            version,
            path: Some(path_str.clone()),
            required_for: vec!["Flutter".to_string()],
        };
    }

    ToolItem {
        name: "Flutter".to_string(),
        installed: false,
        version: None,
        path: None,
        required_for: vec!["Flutter".to_string()],
    }
}

fn detect_java_tool() -> ToolItem {
    let which_res = which::which("java");
    let path = which_res.ok().map(|p| p.to_string_lossy().to_string());
    let version = run_command_for_version("java", &["-version"]);

    ToolItem {
        name: "Java JDK".to_string(),
        installed: path.is_some(),
        version,
        path,
        required_for: vec!["Flutter (Android)".to_string(), "Kotlin / Compose".to_string()],
    }
}

fn detect_android_sdk_and_adb() -> (Option<String>, ToolItem) {
    let mut sdk_dir: Option<PathBuf> = None;

    if let Ok(env_val) = std::env::var("ANDROID_HOME") {
        let p = PathBuf::from(env_val);
        if p.exists() { sdk_dir = Some(p); }
    }

    if sdk_dir.is_none() {
        if let Ok(env_val) = std::env::var("ANDROID_SDK_ROOT") {
            let p = PathBuf::from(env_val);
            if p.exists() { sdk_dir = Some(p); }
        }
    }

    if sdk_dir.is_none() {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let candidate = PathBuf::from(userprofile).join("AppData").join("Local").join("Android").join("Sdk");
            if candidate.exists() { sdk_dir = Some(candidate); }
        }
    }

    let sdk_path_str = sdk_dir.as_ref().map(|p| p.to_string_lossy().to_string());

    // Check ADB either in PATH or in Android SDK platform-tools
    let adb_in_path = which::which("adb").ok().map(|p| p.to_string_lossy().to_string());
    let adb_resolved = if adb_in_path.is_some() {
        adb_in_path
    } else if let Some(ref sdk) = sdk_dir {
        let adb_candidate = sdk.join("platform-tools").join("adb.exe");
        if adb_candidate.exists() {
            Some(adb_candidate.to_string_lossy().to_string())
        } else {
            None
        }
    } else {
        None
    };

    let adb_version = if let Some(ref adb_p) = adb_resolved {
        run_command_for_version(adb_p, &["version"])
    } else {
        None
    };

    let adb_tool = ToolItem {
        name: "Android ADB".to_string(),
        installed: adb_resolved.is_some(),
        version: adb_version,
        path: adb_resolved,
        required_for: vec!["React Native (Native)".to_string(), "Flutter (Native)".to_string(), "Kotlin (Native)".to_string()],
    };

    (sdk_path_str, adb_tool)
}

fn run_command_for_version(bin: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(bin).args(args).output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    let text = if !stdout.trim().is_empty() { stdout } else { stderr };
    let first_line = text.lines().next()?.trim().to_string();
    if first_line.is_empty() { None } else { Some(first_line) }
}
