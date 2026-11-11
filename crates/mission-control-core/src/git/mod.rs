use crate::command_payload::{acknowledged, parse_payload, to_response};
use crate::command_runner::{run_tool, run_tool_checked, ToolInvocation};
use crate::mission_error::{MissionError, MissionResult};
use crate::projects::project_catalog;
use crate::storage::connection::MissionStore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoStatus {
    pub project_id: String,
    pub project_name: String,
    pub path: String,
    pub branch: String,
    pub modified_count: usize,
    pub untracked_count: usize,
    pub staged_count: usize,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit_hash: String,
    pub last_commit_message: String,
    pub last_commit_relative: String,
    pub last_commit_timestamp: i64,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDayBucket {
    pub date: String,
    pub count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitActionInput {
    project_id: String,
    action: String,
    message: Option<String>,
}

pub fn handle(store: &MissionStore, command: &str, payload: &Value) -> Option<MissionResult<Value>> {
    let result = match command {
        "git.fleet" => inspect_git_fleet(store).and_then(to_response),
        "git.action" => parse_payload::<GitActionInput>(payload).and_then(|input| execute_git_action(store, input)),
        "git.fetchAll" => fetch_all_repositories(store).and_then(to_response),
        "git.heatmap" => compute_commit_heatmap(store).and_then(to_response),
        _ => return None,
    };
    Some(result)
}

pub fn inspect_git_fleet(store: &MissionStore) -> MissionResult<Vec<GitRepoStatus>> {
    let mut projects = project_catalog::cached_catalog(store)?;
    if projects.is_empty() {
        projects = project_catalog::refresh_catalog(store)?;
    }

    let git_projects: Vec<_> = projects
        .into_iter()
        .filter(|proj| proj.has_git && !proj.is_ignored && proj.is_on_disk)
        .collect();

    let mut statuses = Vec::with_capacity(git_projects.len());
    for chunk in git_projects.chunks(8) {
        std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|proj| {
                    scope.spawn(move || inspect_single_repo(&proj.id, &proj.name, Path::new(&proj.path)))
                })
                .collect();
            for handle in handles {
                if let Ok(Some(status)) = handle.join() {
                    statuses.push(status);
                }
            }
        });
    }

    statuses.sort_by(|a, b| {
        b.is_dirty
            .cmp(&a.is_dirty)
            .then_with(|| b.last_commit_timestamp.cmp(&a.last_commit_timestamp))
    });
    Ok(statuses)
}

pub fn inspect_single_repo(project_id: &str, project_name: &str, repo_path: &Path) -> Option<GitRepoStatus> {
    if !repo_path.join(".git").exists() {
        return None;
    }
    let status_out = run_tool(&ToolInvocation {
        program: "git",
        args: &["status", "--porcelain=v2", "--branch"],
        working_dir: Some(repo_path),
    })
    .ok()?;

    let parsed = parse_porcelain_v2(&status_out.stdout);
    let (hash, msg, rel, ts) = read_last_commit(repo_path);
    let is_dirty = parsed.modified > 0 || parsed.untracked > 0 || parsed.staged > 0;

    Some(GitRepoStatus {
        project_id: project_id.to_string(),
        project_name: project_name.to_string(),
        path: repo_path.to_string_lossy().into_owned(),
        branch: parsed.branch,
        modified_count: parsed.modified,
        untracked_count: parsed.untracked,
        staged_count: parsed.staged,
        ahead: parsed.ahead,
        behind: parsed.behind,
        last_commit_hash: hash,
        last_commit_message: msg,
        last_commit_relative: rel,
        last_commit_timestamp: ts,
        is_dirty,
    })
}

fn read_last_commit(repo_path: &Path) -> (String, String, String, i64) {
    let Ok(out) = run_tool(&ToolInvocation {
        program: "git",
        args: &["log", "-1", "--format=%h|%s|%cr|%ct"],
        working_dir: Some(repo_path),
    }) else {
        return ("—".into(), "Aucun commit".into(), "—".into(), 0);
    };
    let line = out.stdout.lines().next().unwrap_or("").trim();
    let parts: Vec<&str> = line.splitn(4, '|').collect();
    if parts.len() < 4 {
        return ("—".into(), "Aucun commit".into(), "—".into(), 0);
    }
    let timestamp = parts[3].parse::<i64>().unwrap_or(0);
    (parts[0].to_string(), parts[1].to_string(), parts[2].to_string(), timestamp)
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct PorcelainSummary {
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub staged: usize,
    pub modified: usize,
    pub untracked: usize,
}

/// Fonction pure : analyse `git status --porcelain=v2 --branch`.
pub fn parse_porcelain_v2(stdout: &str) -> PorcelainSummary {
    let mut summary = PorcelainSummary {
        branch: "HEAD".to_string(),
        ..Default::default()
    };
    for line in stdout.lines() {
        if let Some(head) = line.strip_prefix("# branch.head ") {
            summary.branch = head.trim().to_string();
        } else if let Some(ab) = line.strip_prefix("# branch.ab ") {
            for token in ab.split_whitespace() {
                if let Some(a) = token.strip_prefix('+') {
                    summary.ahead = a.parse().unwrap_or(0);
                } else if let Some(b) = token.strip_prefix('-') {
                    summary.behind = b.parse().unwrap_or(0);
                }
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            let xy = line.split_whitespace().nth(1).unwrap_or("..");
            let mut chars = xy.chars();
            let x = chars.next().unwrap_or('.');
            let y = chars.next().unwrap_or('.');
            if x != '.' {
                summary.staged += 1;
            }
            if y != '.' {
                summary.modified += 1;
            }
        } else if line.starts_with("? ") {
            summary.untracked += 1;
        }
    }
    summary
}

fn execute_git_action(store: &MissionStore, input: GitActionInput) -> MissionResult<Value> {
    let repo_path = project_catalog::project_path(store, &input.project_id)?;
    match input.action.as_str() {
        "fetch" => {
            run_tool_checked(&ToolInvocation {
                program: "git",
                args: &["fetch", "--all", "--prune"],
                working_dir: Some(&repo_path),
            })?;
        }
        "pull" => {
            run_tool_checked(&ToolInvocation {
                program: "git",
                args: &["pull", "--rebase", "--autostash"],
                working_dir: Some(&repo_path),
            })?;
        }
        "push" => {
            run_tool_checked(&ToolInvocation {
                program: "git",
                args: &["push"],
                working_dir: Some(&repo_path),
            })?;
        }
        "commit" => {
            let msg = input.message.as_deref().unwrap_or("").trim();
            if msg.is_empty() {
                return Err(MissionError::invalid_payload("Le message de commit est requis"));
            }
            run_tool_checked(&ToolInvocation {
                program: "git",
                args: &["add", "-A"],
                working_dir: Some(&repo_path),
            })?;
            run_tool_checked(&ToolInvocation {
                program: "git",
                args: &["commit", "-m", msg],
                working_dir: Some(&repo_path),
            })?;
        }
        other => return Err(MissionError::invalid_payload(format!("Action Git inconnue : {other}"))),
    }
    acknowledged()
}

fn fetch_all_repositories(store: &MissionStore) -> MissionResult<usize> {
    let projects = project_catalog::cached_catalog(store)?;
    let git_paths: Vec<_> = projects
        .into_iter()
        .filter(|p| p.has_git && !p.is_ignored && p.is_on_disk)
        .map(|p| p.path)
        .collect();

    let count = git_paths.len();
    for chunk in git_paths.chunks(8) {
        std::thread::scope(|scope| {
            for path in chunk {
                scope.spawn(move || {
                    let _ = run_tool(&ToolInvocation {
                        program: "git",
                        args: &["fetch", "--all", "--prune"],
                        working_dir: Some(Path::new(path)),
                    });
                });
            }
        });
    }
    Ok(count)
}

fn compute_commit_heatmap(store: &MissionStore) -> MissionResult<Vec<CommitDayBucket>> {
    let projects = project_catalog::cached_catalog(store)?;
    let mut buckets: BTreeMap<String, u32> = BTreeMap::new();
    for proj in projects.iter().filter(|p| p.has_git && p.is_on_disk) {
        let Ok(out) = run_tool(&ToolInvocation {
            program: "git",
            args: &["log", "--since=180 days ago", "--date=short", "--format=%ad"],
            working_dir: Some(Path::new(&proj.path)),
        }) else {
            continue;
        };
        for date in out.stdout.lines().map(str::trim).filter(|l| l.len() == 10) {
            *buckets.entry(date.to_string()).or_insert(0) += 1;
        }
    }
    Ok(buckets
        .into_iter()
        .map(|(date, count)| CommitDayBucket { date, count })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_porcelain_v2_output() {
        let sample = "# branch.oid 123456\n# branch.head main\n# branch.ab +3 -1\n1 M. N... 100644 100644 100644 abc def src/lib.rs\n1 .M N... 100644 100644 100644 abc def README.md\n? newfile.txt\n";
        let summary = parse_porcelain_v2(sample);
        assert_eq!(summary.branch, "main");
        assert_eq!(summary.ahead, 3);
        assert_eq!(summary.behind, 1);
        assert_eq!(summary.staged, 1);
        assert_eq!(summary.modified, 1);
        assert_eq!(summary.untracked, 1);
    }
}

