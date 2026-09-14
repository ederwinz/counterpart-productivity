mod commands;
mod db;
mod hosts;
mod presets;
mod scheduler;

use db::Db;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};
use tauri_plugin_notification::{NotificationExt, PermissionState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            commands::smart_open(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let conn = db::init(app_data_dir);
            app.manage(Db(Mutex::new(conn)));

            if app.notification().permission_state()? == PermissionState::Prompt {
                app.notification().request_permission()?;
            }

            let dashboard_item =
                MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&dashboard_item, &quit_item])?;

            TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/32x32.png"
                ))?)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "dashboard" => {
                        // Context-aware: shows the live countdown popover if a session
                        // is running, otherwise opens the Dashboard. macOS always shows
                        // the attached tray menu on click (show_menu_on_left_click has
                        // no effect once a menu is set), so this menu item is the only
                        // entry point — it has to do the right thing either way.
                        commands::smart_open(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            scheduler::reconcile(app.handle());
            scheduler::spawn(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().ok();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::list_tasks,
            commands::delete_task,
            commands::update_task_status,
            commands::pause_task,
            commands::resume_task,
            commands::list_focus_tasks,
            commands::create_focus_task,
            commands::archive_focus_task,
            commands::list_blocked_sites,
            commands::add_blocked_site,
            commands::remove_blocked_site,
            commands::check_hosts_permission,
            commands::grant_hosts_permission,
            commands::open_dashboard,
            commands::list_presets,
            commands::start_preset_session,
            commands::list_custom_presets,
            commands::create_custom_preset,
            commands::delete_custom_preset,
            commands::start_custom_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
