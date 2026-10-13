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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            stt_status,
            transcribe_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

