use serde::{Deserialize, Serialize};

pub fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
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

pub fn find_gh_bin() -> Option<String> {
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
pub fn get_gh_cli_auth() -> GhCliAuthStatus {
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

