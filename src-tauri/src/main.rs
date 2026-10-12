// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub relative_time: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitRepoInfo {
    pub branch: Option<String>,
    pub modified_count: usize,
    pub is_clean: bool,
}

#[tauri::command]
fn get_git_branch() -> Option<String> {
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()?;

    if output.status.success() {
        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !branch.is_empty() && branch != "HEAD" {
            return Some(branch);
        }
    }
    None
}

#[tauri::command]
fn get_recent_commits(limit: Option<usize>) -> Vec<GitCommit> {
    let n = limit.unwrap_or(5);
    let output = match std::process::Command::new("git")
        .args(["log", &format!("-n{}", n), "--pretty=format:%h|%an|%ar|%s"])
        .output()
    {
        Ok(out) => out,
        Err(_) => return Vec::new(),
    };

    if !output.status.success() {
        return Vec::new();
    }

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() == 4 {
                Some(GitCommit {
                    hash: parts[0].to_string(),
                    author: parts[1].to_string(),
                    relative_time: parts[2].to_string(),
                    message: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
fn get_git_status() -> GitRepoInfo {
    let branch = get_git_branch();
    let status_output = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .ok();

    let modified_count = match status_output {
        Some(ref out) if out.status.success() => {
            let txt = String::from_utf8_lossy(&out.stdout);
            txt.lines().filter(|l| !l.trim().is_empty()).count()
        }
        _ => 0,
    };

    GitRepoInfo {
        branch,
        modified_count,
        is_clean: modified_count == 0,
    }
}

fn main() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create synapselog schema",
            sql: include_str!("./migrations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add second assignee columns for avatar stacks",
            sql: include_str!("./migrations2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create team_groups table and link tasks to groups",
            sql: include_str!("./migrations3.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:synapse.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_git_branch,
            get_recent_commits,
            get_git_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

