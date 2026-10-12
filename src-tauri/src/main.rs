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

// ── RubaiSTT (local Uzbek STT via whisper.cpp) ────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SttStatus {
    pub binary_ok: bool,
    pub model_ok: bool,
    pub bin_path: String,
    pub model_path: String,
}

fn whisper_bin() -> String {
    std::env::var("WHISPER_BIN").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/farhod".to_string());
        format!("{}/.local/bin/whisper-cli", home)
    })
}

fn rubai_model_path() -> String {
    std::env::var("RUBAI_MODEL").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/farhod".to_string());
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
    let output = std::process::Command::new(&st.bin_path)
        .args([
            "-m", &st.model_path,
            "-l", &lang,
            "-f", &wav_path.to_string_lossy(),
            "-t", "8",
            "--output-txt",
            "--output-file", &out_prefix,
            "-np", "-nt",
        ])
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
        Migration {
            version: 4,
            description: "add tags column for real tag system",
            sql: include_str!("./migrations4.sql"),
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
            get_git_status,
            stt_status,
            transcribe_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

