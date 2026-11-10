use crate::system::home_dir;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SttStatus {
    pub binary_ok: bool,
    pub model_ok: bool,
    pub bin_path: String,
    pub model_path: String,
}

pub fn whisper_bin() -> String {
    std::env::var("WHISPER_BIN").unwrap_or_else(|_| {
        let home = home_dir();
        if cfg!(target_os = "windows") {
            format!("{}/.local/bin/whisper-cli.exe", home)
        } else {
            let candidates = [
                format!("{}/.local/bin/whisper-cli", home),
                format!("{}/.cognidev/bin/whisper-cli", home),
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

pub fn rubai_model_path() -> String {
    std::env::var("RUBAI_MODEL").unwrap_or_else(|_| {
        let home = home_dir();
        let candidates = [
            format!("{}/.cognidev/models/ggml-rubaistt.bin", home),
            format!("{}/rubai-stt/models/ggml-rubaistt.bin", home),
            format!(
                "{}/Downloads/app/uzbek-dictation-main/whisper.cpp/models/ggml-rubaistt.bin",
                home
            ),
        ];
        for c in candidates {
            if std::path::Path::new(&c).is_file() {
                return c;
            }
        }
        format!("{}/.cognidev/models/ggml-rubaistt.bin", home)
    })
}

#[tauri::command]
pub fn stt_status() -> SttStatus {
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
pub async fn download_rubai_model() -> Result<String, String> {
    let home = home_dir();
    let model_dir = format!("{}/.cognidev/models", home);
    let model_file = format!("{}/ggml-rubaistt.bin", model_dir);

    if std::path::Path::new(&model_file).is_file() {
        return Ok("Model allaqachon yuklab olingan".to_string());
    }

    if let Err(e) = std::fs::create_dir_all(&model_dir) {
        return Err(format!("Papka yaratishda xatolik: {e}"));
    }

    let url =
        "https://github.com/MuhammadMirrr/uzbek-dictation/releases/download/v1.0/ggml-rubaistt.bin";
    let output = std::process::Command::new("curl")
        .args(["-L", "-f", "-s", "-S", "-o", &model_file, url])
        .output()
        .map_err(|e| format!("curl ishga tushirishda xatolik: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_file(&model_file);
        return Err(format!("Modelni yuklab olishda xatolik: {err}"));
    }

    if !std::path::Path::new(&model_file).is_file() {
        return Err("Model fayli yaratilmadi".to_string());
    }

    Ok("Model muvaffaqiyatli yuklab olindi".to_string())
}

#[tauri::command]
pub fn open_mic_settings() -> Result<(), String> {
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
pub fn reset_mic_permission() -> Result<String, String> {
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
#[tauri::command]
pub fn transcribe_audio_detailed(
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
pub fn transcribe_audio(audio_b64: String, lang: Option<String>) -> Result<String, String> {
    transcribe_audio_detailed(audio_b64, lang).map(|r| r.text)
}

#[tauri::command]
pub fn save_meeting_audio(
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
pub fn read_meeting_audio(file_path: String) -> Result<String, String> {
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
pub fn delete_meeting_audio(file_path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&file_path);
    if path.is_file() {
        let _ = std::fs::remove_file(path);
        Ok(true)
    } else {
        Ok(false)
    }
}

