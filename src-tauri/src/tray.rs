use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

pub fn build_tray_menu<R: tauri::Runtime>(
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
pub fn update_tray_focus(app: tauri::AppHandle, focus_tasks: Vec<String>) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main_tray") {
        if let Ok(new_menu) = build_tray_menu(&app, &focus_tasks) {
            let _ = tray.set_menu(Some(new_menu));
        }
    }
    Ok(())
}
