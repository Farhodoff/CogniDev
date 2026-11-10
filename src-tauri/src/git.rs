use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommitItem {
    pub hash: String,
    pub author: String,
    pub time_ago: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitFileChange {
    pub status: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitRepoInfo {
    pub is_repo: bool,
    pub repo_root: String,
    pub branch: String,
    pub remote_url: String,
    pub modified_count: usize,
    pub untracked_count: usize,
    pub staged_count: usize,
    pub files: Vec<GitFileChange>,
    pub recent_commits: Vec<GitCommitItem>,
    pub diff_summary: String,
    pub diff_content: String,
}

pub fn run_git_cmd(dir: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(dir);
    cmd.args(args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("git buyrug'i bajarilmadi: {e}"))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() {
            "git xatosi".to_string()
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn resolve_repo_dir(input: Option<String>) -> Result<String, String> {
    let raw = input.unwrap_or_else(|| ".".to_string());
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(".".to_string());
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Err("Ko'rsatilgan manzil veb-havola (URL). Iltimos, kompyuteringizdagi lokal Git katalogini tanlang.".to_string());
    }
    if trimmed.starts_with("~/") || trimmed == "~" {
        if let Some(home) = std::env::var_os("HOME") {
            let mut path = std::path::PathBuf::from(home);
            if trimmed.len() > 2 {
                path.push(&trimmed[2..]);
            }
            return Ok(path.to_string_lossy().to_string());
        }
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn get_git_repo_info(repo_path: Option<String>) -> Result<GitRepoInfo, String> {
    let dir = resolve_repo_dir(repo_path)?;
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("Katalog topilmadi: {dir}"));
    }

    let toplevel = run_git_cmd(&dir, &["rev-parse", "--show-toplevel"])
        .map_err(|_| "Ushbu katalog Git repozitoriyasi emas.".to_string())?;

    let branch = run_git_cmd(&toplevel, &["branch", "--show-current"])
        .unwrap_or_else(|_| "HEAD".to_string());

    let remote_url =
        run_git_cmd(&toplevel, &["remote", "get-url", "origin"]).unwrap_or_else(|_| "".to_string());

    let status_raw = run_git_cmd(&toplevel, &["status", "--porcelain"]).unwrap_or_default();

    let mut files = Vec::new();
    let mut modified_count = 0;
    let mut untracked_count = 0;
    let mut staged_count = 0;

    for line in status_raw.lines() {
        if line.len() >= 3 {
            let status = line[..2].trim().to_string();
            let file_path = line[3..].trim().to_string();
            if status == "??" {
                untracked_count += 1;
            } else if status.starts_with('M') || status.starts_with('A') || status.starts_with('D')
            {
                staged_count += 1;
            } else {
                modified_count += 1;
            }
            files.push(GitFileChange {
                status,
                path: file_path,
            });
        }
    }

    let log_raw = run_git_cmd(
        &toplevel,
        &["log", "-n", "8", "--pretty=format:%h|%an|%ar|%s"],
    )
    .unwrap_or_default();

    let mut recent_commits = Vec::new();
    for line in log_raw.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            recent_commits.push(GitCommitItem {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                time_ago: parts[2].to_string(),
                message: parts[3..].join("|"),
            });
        }
    }

    let diff_summary = run_git_cmd(&toplevel, &["diff", "--stat"]).unwrap_or_default();

    let diff_full = run_git_cmd(&toplevel, &["diff", "HEAD"])
        .unwrap_or_else(|_| run_git_cmd(&toplevel, &["diff"]).unwrap_or_default());

    let diff_truncated: String = diff_full
        .lines()
        .take(250)
        .collect::<Vec<&str>>()
        .join("\n");

    Ok(GitRepoInfo {
        is_repo: true,
        repo_root: toplevel,
        branch,
        remote_url,
        modified_count,
        untracked_count,
        staged_count,
        files,
        recent_commits,
        diff_summary,
        diff_content: diff_truncated,
    })
}

#[tauri::command]
pub fn git_commit_changes(repo_path: Option<String>, message: String) -> Result<String, String> {
    let dir = resolve_repo_dir(repo_path)?;
    if message.trim().is_empty() {
        return Err("Commit xabari bo'sh bo'lishi mumkin emas.".to_string());
    }
    run_git_cmd(&dir, &["add", "-A"])?;
    let out = run_git_cmd(&dir, &["commit", "-m", &message])?;
    Ok(out)
}

#[tauri::command]
pub fn git_init_repo(repo_path: Option<String>) -> Result<String, String> {
    let dir = resolve_repo_dir(repo_path)?;
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("Katalog topilmadi: {dir}"));
    }
    let out = run_git_cmd(&dir, &["init"])?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_repo_dir() {
        assert_eq!(resolve_repo_dir(None).unwrap(), ".");
        assert_eq!(resolve_repo_dir(Some("".to_string())).unwrap(), ".");
        assert!(resolve_repo_dir(Some("https://github.com/foo/bar".to_string())).is_err());
        assert_eq!(resolve_repo_dir(Some("/tmp/myrepo".to_string())).unwrap(), "/tmp/myrepo");
    }
}
