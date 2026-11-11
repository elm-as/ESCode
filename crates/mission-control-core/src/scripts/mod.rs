use crate::command_payload::{parse_payload, to_response};
use crate::command_runner::{run_tool, ToolInvocation};
use crate::mission_error::MissionResult;
use crate::projects::project_catalog;
use crate::storage::connection::MissionStore;
use crate::storage::tracking_repo;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScriptItem {
    pub name: String,
    pub command_line: String,
    pub source: String, // "package.json" | "cargo" | "flutter" | "custom"
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubRepoPulse {
    pub authenticated: bool,
    pub account: String,
    pub open_prs: Vec<GithubItemSummary>,
    pub open_issues: Vec<GithubItemSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubItemSummary {
    pub number: u64,
    pub title: String,
    pub repo_name: String,
    pub state: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutdatedPackageItem {
    pub name: String,
    pub current: String,
    pub latest: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetlifySiteStatus {
    pub linked: bool,
    pub site_id: String,
    pub site_name: String,
    pub site_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRef {
    project_id: String,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "scripts.list" => parse_payload::<ProjectRef>(payload)
            .and_then(|input| discover_project_scripts(store, &input.project_id))
            .and_then(to_response),
        "github.pulse" => query_github_pulse(store).and_then(to_response),
        "dependencies.outdated" => parse_payload::<ProjectRef>(payload)
            .and_then(|input| check_outdated_dependencies(store, &input.project_id))
            .and_then(to_response),
        "deployments.status" => parse_payload::<ProjectRef>(payload)
            .and_then(|input| inspect_netlify_status(store, &input.project_id))
            .and_then(to_response),
        _ => return None,
    };
    Some(result)
}

pub fn discover_project_scripts(
    store: &MissionStore,
    project_id: &str,
) -> MissionResult<Vec<ProjectScriptItem>> {
    let root = project_catalog::project_path(store, project_id)?;
    let mut items = Vec::new();

    if let Ok(pkg_raw) = fs::read_to_string(root.join("package.json")) {
        if let Ok(pkg_json) = serde_json::from_str::<Value>(&pkg_raw) {
            if let Some(scripts) = pkg_json.get("scripts").and_then(Value::as_object) {
                for (name, cmd) in scripts {
                    items.push(ProjectScriptItem {
                        name: name.clone(),
                        command_line: format!("pnpm run {name}  # {}", cmd.as_str().unwrap_or("")),
                        source: "package.json".to_string(),
                    });
                }
            }
        }
    }

    if root.join("Cargo.toml").is_file() || root.join("src-tauri/Cargo.toml").is_file() {
        for (name, cmd) in [("cargo check", "cargo check"), ("cargo test", "cargo test"), ("cargo build", "cargo build")] {
            items.push(ProjectScriptItem {
                name: name.to_string(),
                command_line: cmd.to_string(),
                source: "cargo".to_string(),
            });
        }
    }

    if root.join("pubspec.yaml").is_file() {
        for (name, cmd) in [("flutter pub get", "flutter pub get"), ("flutter analyze", "flutter analyze"), ("flutter test", "flutter test")] {
            items.push(ProjectScriptItem {
                name: name.to_string(),
                command_line: cmd.to_string(),
                source: "flutter".to_string(),
            });
        }
    }

    let custom = store.with(|conn| tracking_repo::list_commands(conn, project_id))?;
    for c in custom {
        items.push(ProjectScriptItem {
            name: c.label,
            command_line: c.command_line,
            source: "custom".to_string(),
        });
    }
    Ok(items)
}

pub fn query_github_pulse(store: &MissionStore) -> MissionResult<GithubRepoPulse> {
    let auth = run_tool(&ToolInvocation {
        program: "gh",
        args: &["auth", "status"],
        working_dir: None,
    });
    let Ok(auth_out) = auth else {
        return Ok(GithubRepoPulse {
            authenticated: false,
            account: String::new(),
            open_prs: Vec::new(),
            open_issues: Vec::new(),
        });
    };
    let combined = format!("{}\n{}", auth_out.stdout, auth_out.stderr);
    let authenticated = auth_out.success || combined.contains("Logged in to");
    let account = extract_gh_account(&combined);

    let mut open_prs = Vec::new();
    let mut open_issues = Vec::new();

    if authenticated {
        let projects = project_catalog::cached_catalog(store).unwrap_or_default();
        for proj in projects.iter().filter(|p| p.has_git && p.status == "active").take(4) {
            let (prs, issues) = collect_repo_gh_items(Path::new(&proj.path), &proj.name);
            open_prs.extend(prs);
            open_issues.extend(issues);
        }
    }

    Ok(GithubRepoPulse {
        authenticated,
        account,
        open_prs,
        open_issues,
    })
}

fn extract_gh_account(text: &str) -> String {
    for line in text.lines() {
        if let Some(idx) = line.find("account ") {
            let after = &line[idx + 8..];
            if let Some(acct) = after.split_whitespace().next() {
                return acct.trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_').to_string();
            }
        }
    }
    "GitHub CLI".to_string()
}

fn collect_repo_gh_items(
    repo_path: &Path,
    repo_name: &str,
) -> (Vec<GithubItemSummary>, Vec<GithubItemSummary>) {
    let mut prs = Vec::new();
    let mut issues = Vec::new();
    if let Ok(pr_out) = run_tool(&ToolInvocation {
        program: "gh",
        args: &["pr", "list", "--limit", "5", "--json", "number,title,state,url"],
        working_dir: Some(repo_path),
    }) {
        if pr_out.success {
            prs.extend(parse_gh_items(&pr_out.stdout, repo_name));
        }
    }
    if let Ok(iss_out) = run_tool(&ToolInvocation {
        program: "gh",
        args: &["issue", "list", "--limit", "5", "--json", "number,title,state,url"],
        working_dir: Some(repo_path),
    }) {
        if iss_out.success {
            issues.extend(parse_gh_items(&iss_out.stdout, repo_name));
        }
    }
    (prs, issues)
}

fn parse_gh_items(raw_json: &str, repo_name: &str) -> Vec<GithubItemSummary> {
    let Ok(arr) = serde_json::from_str::<Vec<Value>>(raw_json) else {
        return Vec::new();
    };
    arr.into_iter()
        .filter_map(|v| {
            Some(GithubItemSummary {
                number: v.get("number")?.as_u64()?,
                title: v.get("title")?.as_str()?.to_string(),
                repo_name: repo_name.to_string(),
                state: v.get("state")?.as_str().unwrap_or("OPEN").to_string(),
                url: v.get("url")?.as_str().unwrap_or("").to_string(),
            })
        })
        .collect()
}

pub fn check_outdated_dependencies(
    store: &MissionStore,
    project_id: &str,
) -> MissionResult<Vec<OutdatedPackageItem>> {
    let root = project_catalog::project_path(store, project_id)?;
    if !root.join("package.json").is_file() {
        return Ok(Vec::new());
    }
    let Ok(out) = run_tool(&ToolInvocation {
        program: "npm",
        args: &["outdated", "--json"],
        working_dir: Some(&root),
    }) else {
        return Ok(Vec::new());
    };
    let Ok(obj) = serde_json::from_str::<Value>(&out.stdout) else {
        return Ok(Vec::new());
    };
    let Some(map) = obj.as_object() else {
        return Ok(Vec::new());
    };
    Ok(map
        .iter()
        .map(|(name, info)| OutdatedPackageItem {
            name: name.clone(),
            current: info.get("current").and_then(Value::as_str).unwrap_or("—").to_string(),
            latest: info.get("latest").and_then(Value::as_str).unwrap_or("—").to_string(),
        })
        .collect())
}

pub fn inspect_netlify_status(store: &MissionStore, project_id: &str) -> MissionResult<NetlifySiteStatus> {
    let detail = project_catalog::project_detail(store, project_id)?;
    let root = Path::new(&detail.summary.path);
    let state_file = root.join(".netlify").join("state.json");
    let mut site_id = detail.netlify_site_id;

    if site_id.is_empty() && state_file.is_file() {
        if let Ok(raw) = fs::read_to_string(&state_file) {
            if let Ok(json) = serde_json::from_str::<Value>(&raw) {
                site_id = json.get("siteId").and_then(Value::as_str).unwrap_or("").to_string();
            }
        }
    }

    Ok(NetlifySiteStatus {
        linked: !site_id.is_empty() || !detail.summary.prod_url.is_empty(),
        site_id,
        site_name: detail.summary.name,
        site_url: detail.summary.prod_url,
    })
}
