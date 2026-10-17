// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri_plugin_sql::{Migration, MigrationKind};

// ── RubaiSTT (local Uzbek STT via whisper.cpp) ────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SttStatus {
    pub binary_ok: bool,
    pub model_ok: bool,
    pub bin_path: String,
    pub model_path: String,
}

fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string())
}

fn whisper_bin() -> String {
    std::env::var("WHISPER_BIN").unwrap_or_else(|_| {
        let home = home_dir();
        if cfg!(target_os = "windows") {
            format!("{}/.local/bin/whisper-cli.exe", home)
        } else {
            format!("{}/.local/bin/whisper-cli", home)
        }
    })
}

fn rubai_model_path() -> String {
    std::env::var("RUBAI_MODEL").unwrap_or_else(|_| {
        let home = home_dir();
        format!("{}/rubai-stt/models/ggml-rubaistt.bin", home)
    })
}

#[tauri::command]
fn stt_status() -> SttStatus {
    let bin_path = whisper_bin();
    let model_path = rubai_model_path();
    SttStatus {
        binary_ok: std::path::Path::new(&bin_path).is_file(),
        model_ok: std::path::Path::new(&model_path).is_file(),
        bin_path,
        model_path,
    }
}

/// Transcribe 16kHz mono WAV audio (base64) with the local rubaiSTT model.
/// Returns plain Uzbek text without timestamps.
#[tauri::command]
fn transcribe_audio(audio_b64: String, lang: Option<String>) -> Result<String, String> {
    use base64::Engine as _;
    let st = stt_status();
    if !st.binary_ok {
        return Err(format!("whisper-cli topilmadi: {}", st.bin_path));
    }
    if !st.model_ok {
        return Err(format!("rubaiSTT model topilmadi: {}", st.model_path));
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(audio_b64.trim())
        .map_err(|e| format!("audio dekodlanmadi: {e}"))?;
    if bytes.len() < 1000 {
        return Err("audio juda qisqa (1KB dan kam)".to_string());
    }

    let mut wav_path = std::env::temp_dir();
    wav_path.push(format!("cognidev-stt-{}.wav", std::process::id()));
    std::fs::write(&wav_path, &bytes).map_err(|e| format!("vaqtinchalik fayl yozilmadi: {e}"))?;

    let out_prefix = wav_path.to_string_lossy().replace(".wav", "-out");
    let lang = lang.unwrap_or_else(|| "uz".to_string());
    let mut cmd = std::process::Command::new(&st.bin_path);
    cmd.args([
        "-m",
        &st.model_path,
        "-l",
        &lang,
        "-f",
        &wav_path.to_string_lossy(),
        "-t",
        "8",
        "--output-txt",
        "--output-file",
        &out_prefix,
        "-np",
        "-nt",
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("whisper ishga tushmadi: {e}"))?;

    let _ = std::fs::remove_file(&wav_path);
    if !output.status.success() {
        return Err(format!(
            "transkripsiya xatosi: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let txt_path = format!("{}.txt", out_prefix);
    let text = std::fs::read_to_string(&txt_path).map_err(|e| format!("natija o'qilmadi: {e}"))?;
    let _ = std::fs::remove_file(&txt_path);

    // Strip any residual "[00:00:00.000 --> ...]" prefixes, join segments.
    let clean: Vec<String> = text
        .lines()
        .map(|l| {
            let t = l.trim();
            if let Some(idx) = t.find(']') {
                if t.starts_with('[') {
                    return t[idx + 1..].trim().to_string();
                }
            }
            t.to_string()
        })
        .filter(|l| !l.is_empty())
        .collect();
    Ok(clean.join(" "))
}

// ── Git Local Integration ───────────────────────────────────

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

fn run_git_cmd(dir: &str, args: &[&str]) -> Result<String, String> {
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

#[tauri::command]
fn get_git_repo_info(repo_path: Option<String>) -> Result<GitRepoInfo, String> {
    let dir = repo_path.unwrap_or_else(|| ".".to_string());
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("Katalog topilmadi: {dir}"));
    }

    // Check if valid repo
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
fn git_commit_changes(repo_path: Option<String>, message: String) -> Result<String, String> {
    let dir = repo_path.unwrap_or_else(|| ".".to_string());
    if message.trim().is_empty() {
        return Err("Commit xabari bo'sh bo'lishi mumkin emas.".to_string());
    }
    run_git_cmd(&dir, &["add", "-A"])?;
    let out = run_git_cmd(&dir, &["commit", "-m", &message])?;
    Ok(out)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GhCliAuthStatus {
    pub is_installed: bool,
    pub is_authenticated: bool,
    pub username: String,
    pub token: String,
}

fn find_gh_bin() -> Option<String> {
    let candidates = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"];
    for p in candidates {
        if std::path::Path::new(p).is_file() {
            return Some(p.to_string());
        }
    }
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    if let Ok(out) = std::process::Command::new(which_cmd).arg("gh").output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !p.is_empty() && std::path::Path::new(&p).is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[tauri::command]
fn get_gh_cli_auth() -> GhCliAuthStatus {
    let mut status = GhCliAuthStatus {
        is_installed: false,
        is_authenticated: false,
        username: String::new(),
        token: String::new(),
    };

    let gh_path = match find_gh_bin() {
        Some(p) => {
            status.is_installed = true;
            p
        }
        None => return status,
    };

    let mut token_cmd = std::process::Command::new(&gh_path);
    token_cmd.args(["auth", "token"]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        token_cmd.creation_flags(0x0800_0000);
    }

    if let Ok(output) = token_cmd.output() {
        if output.status.success() {
            let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !token.is_empty() {
                status.is_authenticated = true;
                status.token = token;

                let mut user_cmd = std::process::Command::new(&gh_path);
                user_cmd.args(["api", "user", "--jq", ".login"]);
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    user_cmd.creation_flags(0x0800_0000);
                }
                if let Ok(user_out) = user_cmd.output() {
                    if user_out.status.success() {
                        status.username =
                            String::from_utf8_lossy(&user_out.stdout).trim().to_string();
                    }
                }
            }
        }
    }

    status
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
        Migration {
            version: 4,
            description: "add tags column for real tag system",
            sql: include_str!("./migrations4.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create notes, roadmaps, learning_logs and project_ideas tables",
            sql: include_str!("./migrations5.sql"),
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            stt_status,
            transcribe_audio,
            get_git_repo_info,
            git_commit_changes,
            get_gh_cli_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
