use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScheduledNotificationItem {
    pub id: String,
    pub target_epoch_secs: u64,
    pub title: String,
    pub body: String,
}

static SCHEDULED_NOTIFICATIONS: OnceLock<Arc<Mutex<Vec<ScheduledNotificationItem>>>> =
    OnceLock::new();

pub fn get_scheduled_notifications() -> &'static Arc<Mutex<Vec<ScheduledNotificationItem>>> {
    SCHEDULED_NOTIFICATIONS.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

pub fn trigger_native_os_notification(title: &str, body: &str) {
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
pub fn show_system_notification(title: String, body: String) -> Result<(), String> {
    trigger_native_os_notification(&title, &body);
    Ok(())
}

#[tauri::command]
pub fn schedule_system_notification(
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
pub fn cancel_scheduled_notification(id: String) -> Result<(), String> {
    let store = get_scheduled_notifications();
    if let Ok(mut list) = store.lock() {
        list.retain(|item| item.id != id);
    }
    Ok(())
}

#[tauri::command]
pub fn speak_text(text: String) -> Result<(), String> {
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
