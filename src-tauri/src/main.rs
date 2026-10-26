// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::SystemTime;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
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
            let candidates = [
                format!("{}/.local/bin/whisper-cli", home),
                format!(
                    "{}/Downloads/app/uzbek-dictation-main/whisper.cpp/build-cli/bin/whisper-cli",
                    home
                ),
                "/opt/homebrew/bin/whisper-cli".to_string(),
                "/usr/local/bin/whisper-cli".to_string(),
            ];
            for c in candidates {
                if std::path::Path::new(&c).is_file() {
                    return c;
                }
            }
            format!("{}/.local/bin/whisper-cli", home)
        }
    })
}

fn rubai_model_path() -> String {
    std::env::var("RUBAI_MODEL").unwrap_or_else(|_| {
        let home = home_dir();
        let candidates = [
            format!("{}/rubai-stt/models/ggml-rubaistt.bin", home),
            format!(
                "{}/Downloads/app/uzbek-dictation-main/whisper.cpp/models/ggml-rubaistt.bin",
                home
            ),
            format!("{}/.cognidev/models/ggml-rubaistt.bin", home),
        ];
        for c in candidates {
            if std::path::Path::new(&c).is_file() {
                return c;
            }
        }
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

#[tauri::command]
fn open_mic_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .spawn()
            .map_err(|e| format!("Sozlamalarni ochishda xatolik: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy-microphone"])
            .spawn()
            .map_err(|e| format!("Sozlamalarni ochishda xatolik: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("pavucontrol")
            .spawn()
            .map_err(|e| format!("Sozlamalarni ochishda xatolik: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn reset_mic_permission() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("tccutil")
            .args(["reset", "Microphone", "com.cognidev.desktop"])
            .output()
            .map_err(|e| format!("tccutil xatosi: {e}"))?;
        if output.status.success() {
            Ok("Ruxsat holati muvaffaqiyatli tiklandi".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok("Qayta so'rov yuborildi".to_string())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DetailedTranscription {
    pub text: String,
    pub detected_lang: String,
}

/// Transcribe 16kHz mono WAV audio (base64) with the local rubaiSTT / whisper.cpp model.
/// Supports multi-language: 'auto', 'uz', 'ru', 'en'.
#[tauri::command]
fn transcribe_audio_detailed(
    audio_b64: String,
    lang: Option<String>,
) -> Result<DetailedTranscription, String> {
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
    let lang_req = lang.unwrap_or_else(|| "auto".to_string());
    let mut cmd = std::process::Command::new(&st.bin_path);
    cmd.args([
        "-m",
        &st.model_path,
        "-l",
        &lang_req,
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

    let stderr_str = String::from_utf8_lossy(&output.stderr);
    let mut detected_lang = if lang_req == "auto" {
        "uz".to_string()
    } else {
        lang_req.clone()
    };
    for line in stderr_str.lines() {
        if let Some(idx) = line.find("auto-detected language:") {
            let part = &line[idx + "auto-detected language:".len()..];
            if let Some(tok) = part.split_whitespace().next() {
                detected_lang = tok
                    .trim_matches(|c: char| !c.is_alphabetic())
                    .to_lowercase();
                break;
            }
        }
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

    Ok(DetailedTranscription {
        text: clean.join(" "),
        detected_lang,
    })
}

#[tauri::command]
fn transcribe_audio(audio_b64: String, lang: Option<String>) -> Result<String, String> {
    transcribe_audio_detailed(audio_b64, lang).map(|r| r.text)
}

// ── Meeting Audio Local Disk Storage (~/.cognidev/recordings) ──────

#[tauri::command]
fn save_meeting_audio(
    meeting_id: String,
    audio_b64: String,
    extension: Option<String>,
) -> Result<String, String> {
    use base64::Engine as _;
    let home = home_dir();
    let dir = std::path::PathBuf::from(format!("{}/.cognidev/recordings", home));
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return Err(format!("Papka yaratishda xatolik: {e}"));
    }

    let ext = extension.unwrap_or_else(|| "wav".to_string());
    let safe_id = meeting_id.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "");
    let file_path = dir.join(format!("{}.{}", safe_id, ext));

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(audio_b64.trim())
        .map_err(|e| format!("Base64 dekodlashda xatolik: {e}"))?;

    std::fs::write(&file_path, bytes)
        .map_err(|e| format!("Audio faylni diskka yozishda xatolik: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_meeting_audio(file_path: String) -> Result<String, String> {
    use base64::Engine as _;
    let path = std::path::Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("Audio fayl topilmadi: {file_path}"));
    }

    let bytes = std::fs::read(path).map_err(|e| format!("Faylni o'qishda xatolik: {e}"))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = if file_path.ends_with(".mp3") {
        "audio/mpeg"
    } else if file_path.ends_with(".webm") {
        "audio/webm"
    } else if file_path.ends_with(".m4a") {
        "audio/mp4"
    } else {
        "audio/wav"
    };

    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn delete_meeting_audio(file_path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&file_path);
    if path.is_file() {
        let _ = std::fs::remove_file(path);
        Ok(true)
    } else {
        Ok(false)
    }
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

fn resolve_repo_dir(input: Option<String>) -> Result<String, String> {
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
fn get_git_repo_info(repo_path: Option<String>) -> Result<GitRepoInfo, String> {
    let dir = resolve_repo_dir(repo_path)?;
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
    let dir = resolve_repo_dir(repo_path)?;
    if message.trim().is_empty() {
        return Err("Commit xabari bo'sh bo'lishi mumkin emas.".to_string());
    }
    run_git_cmd(&dir, &["add", "-A"])?;
    let out = run_git_cmd(&dir, &["commit", "-m", &message])?;
    Ok(out)
}

#[tauri::command]
fn git_init_repo(repo_path: Option<String>) -> Result<String, String> {
    let dir = resolve_repo_dir(repo_path)?;
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("Katalog topilmadi: {dir}"));
    }
    let out = run_git_cmd(&dir, &["init"])?;
    Ok(out)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let clean = url.trim();
    if clean.is_empty() {
        return Err("URL bo'sh bo'lishi mumkin emas".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(clean)
            .spawn()
            .map_err(|e| format!("URLni ochib bo'lmadi: {e}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", clean]);
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("URLni ochib bo'lmadi: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(clean)
            .spawn()
            .map_err(|e| format!("URLni ochib bo'lmadi: {e}"))?;
    }

    Ok(())
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

#[tauri::command]
fn speak_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("say")
            .arg(&text)
            .spawn()
            .map_err(|e| format!("Say xatoligi: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        let escaped = text.replace('"', "\"\"");
        let ps_cmd = format!(
            "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak(\"{}\")",
            escaped
        );
        let _ = std::process::Command::new("powershell")
            .args(["-Command", &ps_cmd])
            .spawn()
            .map_err(|e| format!("Speech xatoligi: {e}"))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = std::process::Command::new("spd-say")
            .arg(&text)
            .spawn()
            .map_err(|e| format!("Speech xatoligi: {e}"))?;
        Ok(())
    }
}

// ── Native OS Notifications & Background Scheduler ───────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScheduledNotificationItem {
    pub id: String,
    pub target_epoch_secs: u64,
    pub title: String,
    pub body: String,
}

static SCHEDULED_NOTIFICATIONS: OnceLock<Arc<Mutex<Vec<ScheduledNotificationItem>>>> =
    OnceLock::new();

fn get_scheduled_notifications() -> &'static Arc<Mutex<Vec<ScheduledNotificationItem>>> {
    SCHEDULED_NOTIFICATIONS.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

fn trigger_native_os_notification(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        let escaped_title = title.replace('\\', "\\\\").replace('"', "\\\"");
        let escaped_body = body.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            "display notification \"{}\" with title \"{}\" sound name \"Glass\"",
            escaped_body, escaped_title
        );
        let _ = std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let escaped_title = title.replace('"', "`\"");
        let escaped_body = body.replace('"', "`\"");
        let ps_cmd = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
             $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
             $textNodes = $template.GetElementsByTagName('text'); \
             $textNodes.Item(0).AppendChild($template.CreateTextNode('{}')) > $null; \
             $textNodes.Item(1).AppendChild($template.CreateTextNode('{}')) > $null; \
             $toast = [Windows.UI.Notifications.ToastNotification]::new($template); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('CogniDev').Show($toast);",
            escaped_title, escaped_body
        );
        let _ = std::process::Command::new("powershell")
            .args(["-Command", &ps_cmd])
            .spawn();
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = std::process::Command::new("notify-send")
            .args([title, body])
            .spawn();
    }
}

#[tauri::command]
fn show_system_notification(title: String, body: String) -> Result<(), String> {
    trigger_native_os_notification(&title, &body);
    Ok(())
}

#[tauri::command]
fn schedule_system_notification(
    id: String,
    target_epoch_secs: u64,
    title: String,
    body: String,
) -> Result<(), String> {
    let store = get_scheduled_notifications();
    if let Ok(mut list) = store.lock() {
        list.retain(|item| item.id != id);
        list.push(ScheduledNotificationItem {
            id,
            target_epoch_secs,
            title,
            body,
        });
    }
    Ok(())
}

#[tauri::command]
fn cancel_scheduled_notification(id: String) -> Result<(), String> {
    let store = get_scheduled_notifications();
    if let Ok(mut list) = store.lock() {
        list.retain(|item| item.id != id);
    }
    Ok(())
}

// ── macOS Menu Bar Tray & Focus Syncer ──────────────

fn build_tray_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    focus_tasks: &[String],
) -> Result<Menu<R>, tauri::Error> {
    let focus_1_text = focus_tasks
        .first()
        .map(|s| s.as_str())
        .unwrap_or("Fokus belgilanmagan");
    let focus_2_text = focus_tasks
        .get(1)
        .map(|s| s.as_str())
        .unwrap_or("Fokus belgilanmagan");
    let focus_3_text = focus_tasks
        .get(2)
        .map(|s| s.as_str())
        .unwrap_or("Fokus belgilanmagan");

    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(
                app,
                "header",
                "⚡️ CogniDev · Bugungi 3 Asosiy Fokus",
                false,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "focus_1",
                format!("1. {focus_1_text}"),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                "focus_2",
                format!("2. {focus_2_text}"),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                "focus_3",
                format!("3. {focus_3_text}"),
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "quick_capture",
                "✨ Tezkor Qayd (Cmd+Shift+Space)",
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "voice_standup", "🎙 Ovozli Standup", true, None::<&str>)?,
            &MenuItem::with_id(app, "show_app", "🖥 Bosh Oynani Ochish", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "🚪 Chiqish", true, None::<&str>)?,
        ],
    )?;
    Ok(menu)
}

#[tauri::command]
fn update_tray_focus(app: tauri::AppHandle, focus_tasks: Vec<String>) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main_tray") {
        if let Ok(new_menu) = build_tray_menu(&app, &focus_tasks) {
            let _ = tray.set_menu(Some(new_menu));
        }
    }
    Ok(())
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Build initial tray menu
            let empty_focus: Vec<String> = Vec::new();
            if let Ok(menu) = build_tray_menu(app.handle(), &empty_focus) {
                let mut builder = TrayIconBuilder::with_id("main_tray")
                    .tooltip("CogniDev — Developer Command Center")
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| {
                        let id_str = event.id().as_ref();
                        match id_str {
                            "quit" => {
                                app.exit(0);
                            }
                            "quick_capture" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                                let _ = app.emit("open_quick_capture", ());
                            }
                            "voice_standup" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                                let _ = app.emit("open_voice_standup", ());
                            }
                            "show_app" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "focus_1" | "focus_2" | "focus_3" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                                let _ = app.emit("tray_focus_selected", id_str);
                            }
                            _ => {}
                        }
                    });

                if let Some(icon) = app.default_window_icon() {
                    builder = builder.icon(icon.clone());
                }

                let _ = builder.build(app);
            }

            // Register global hotkey: Cmd + Shift + Space
            let shortcut_res = "CommandOrControl+Shift+Space".parse::<Shortcut>();
            if let Ok(sc) = shortcut_res {
                let app_handle = app.handle().clone();
                let _ = app
                    .global_shortcut()
                    .on_shortcut(sc, move |_app, _sc, event| {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                            let _ = app_handle.emit("open_quick_capture", ());
                        }
                    });
            }

            // Continuous background timer thread:
            // Checks scheduled notifications and emits second_tick even if window is closed/hidden
            let bg_app_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(1));

                let now = SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let store = get_scheduled_notifications();
                let mut triggered_items = Vec::new();
                if let Ok(mut list) = store.lock() {
                    let mut remaining = Vec::new();
                    for item in list.drain(..) {
                        if item.target_epoch_secs <= now {
                            triggered_items.push(item);
                        } else {
                            remaining.push(item);
                        }
                    }
                    *list = remaining;
                }

                for item in triggered_items {
                    trigger_native_os_notification(&item.title, &item.body);
                    let _ = bg_app_handle.emit("notification_triggered", item);
                }

                let _ = bg_app_handle.emit("second_tick", ());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            stt_status,
            transcribe_audio,
            transcribe_audio_detailed,
            save_meeting_audio,
            read_meeting_audio,
            delete_meeting_audio,
            open_mic_settings,
            reset_mic_permission,
            get_git_repo_info,
            git_commit_changes,
            git_init_repo,
            open_external_url,
            get_gh_cli_auth,
            speak_text,
            update_tray_focus,
            show_system_notification,
            schedule_system_notification,
            cancel_scheduled_notification
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
