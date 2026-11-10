// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod git;
mod notifications;
mod stt;
mod system;
mod tray;

use std::time::SystemTime;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

fn main() {
    let migrations = db::get_migrations();

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
            if let Ok(menu) = tray::build_tray_menu(app.handle(), &empty_focus) {
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

                let store = notifications::get_scheduled_notifications();
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
                    notifications::trigger_native_os_notification(&item.title, &item.body);
                    let _ = bg_app_handle.emit("notification_triggered", item);
                }

                let _ = bg_app_handle.emit("second_tick", ());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            stt::stt_status,
            stt::transcribe_audio,
            stt::transcribe_audio_detailed,
            stt::save_meeting_audio,
            stt::read_meeting_audio,
            stt::delete_meeting_audio,
            stt::open_mic_settings,
            stt::reset_mic_permission,
            stt::download_rubai_model,
            git::get_git_repo_info,
            git::git_commit_changes,
            git::git_init_repo,
            system::open_external_url,
            system::get_gh_cli_auth,
            notifications::speak_text,
            notifications::show_system_notification,
            notifications::schedule_system_notification,
            notifications::cancel_scheduled_notification,
            tray::update_tray_focus
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
