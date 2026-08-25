use crate::db::{
    active_work_task_count, list_blocked_domains, row_to_blocked_site, row_to_focus_task,
    row_to_task, BlockedSite, Db, FocusTask, Task, BLOCKED_SITE_COLUMNS, FOCUS_TASK_COLUMNS,
    SELECT_COLUMNS,
};
use crate::hosts;
use crate::presets::{self, PresetDef};
use chrono::{DateTime, Utc};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    db: State<Db>,
    title: String,
    scheduled_start: DateTime<Utc>,
    duration_minutes: i64,
    focus_task_id: Option<i64>,
) -> Result<Task, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now();
    conn.execute(
        "INSERT INTO tasks (title, scheduled_start, duration_minutes, status, created_at, focus_task_id)
         VALUES (?1, ?2, ?3, 'pending', ?4, ?5)",
        rusqlite::params![title, scheduled_start, duration_minutes, created_at, focus_task_id],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let task = conn
        .query_row(
            &format!("SELECT {SELECT_COLUMNS} FROM tasks WHERE id = ?1"),
            rusqlite::params![id],
            row_to_task,
        )
        .map_err(|e| e.to_string())?;
    let _ = app.emit("task-created", id);
    Ok(task)
}

#[tauri::command]
pub fn list_presets() -> Vec<PresetDef> {
    presets::all()
}

#[tauri::command]
pub fn start_preset_session(
    app: AppHandle,
    db: State<Db>,
    preset_key: String,
    title: String,
    focus_task_id: Option<i64>,
) -> Result<Task, String> {
    let preset = presets::lookup(&preset_key).ok_or_else(|| "Unknown preset".to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();
    let created_at = now;
    conn.execute(
        "INSERT INTO tasks (
            title, scheduled_start, duration_minutes, status, created_at, focus_task_id,
            is_break, cycle_preset, cycle_work_minutes, cycle_break_minutes,
            cycle_long_break_minutes, cycle_rounds_before_long_break, cycle_round,
            cycle_base_title, cycle_focus_task_id
        ) VALUES (?1, ?2, ?3, 'pending', ?4, ?5, 0, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12)",
        rusqlite::params![
            title,
            now,
            preset.work_minutes,
            created_at,
            focus_task_id,
            preset.key,
            preset.work_minutes,
            preset.break_minutes,
            preset.long_break_minutes,
            preset.rounds_before_long_break,
            title,
            focus_task_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let task = conn
        .query_row(
            &format!("SELECT {SELECT_COLUMNS} FROM tasks WHERE id = ?1"),
            rusqlite::params![id],
            row_to_task,
        )
        .map_err(|e| e.to_string())?;
    let _ = app.emit("task-created", id);
    Ok(task)
}

#[tauri::command]
pub fn list_tasks(db: State<Db>) -> Result<Vec<Task>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {SELECT_COLUMNS} FROM tasks ORDER BY scheduled_start ASC"
        ))
        .map_err(|e| e.to_string())?;
    let tasks = stmt
        .query_map([], row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn delete_task(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_task_status(db: State<Db>, id: i64, status: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET status = ?1 WHERE id = ?2",
        rusqlite::params![status, id],
    )
    .map_err(|e| e.to_string())?;

    if status != "active" && active_work_task_count(&conn) == 0 {
        hosts::clear_block();
    }
    Ok(())
}

#[tauri::command]
pub fn list_focus_tasks(db: State<Db>) -> Result<Vec<FocusTask>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {FOCUS_TASK_COLUMNS} FROM focus_tasks ORDER BY created_at ASC"
        ))
        .map_err(|e| e.to_string())?;
    let tasks = stmt
        .query_map([], row_to_focus_task)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn create_focus_task(
    db: State<Db>,
    name: String,
    daily_goal_minutes: i64,
) -> Result<FocusTask, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now();
    conn.execute(
        "INSERT INTO focus_tasks (name, daily_goal_minutes, archived, created_at)
         VALUES (?1, ?2, 0, ?3)",
        rusqlite::params![name, daily_goal_minutes, created_at],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let task = conn
        .query_row(
            &format!("SELECT {FOCUS_TASK_COLUMNS} FROM focus_tasks WHERE id = ?1"),
            rusqlite::params![id],
            row_to_focus_task,
        )
        .map_err(|e| e.to_string())?;
    Ok(task)
}

#[tauri::command]
pub fn archive_focus_task(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE focus_tasks SET archived = 1 WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_blocked_sites(db: State<Db>) -> Result<Vec<BlockedSite>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {BLOCKED_SITE_COLUMNS} FROM blocked_sites ORDER BY created_at ASC"
        ))
        .map_err(|e| e.to_string())?;
    let sites = stmt
        .query_map([], row_to_blocked_site)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(sites)
}

#[tauri::command]
pub fn add_blocked_site(db: State<Db>, domain: String) -> Result<BlockedSite, String> {
    let domain = domain
        .trim()
        .to_lowercase()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("www.")
        .trim_end_matches('/')
        .to_string();
    if domain.is_empty() {
        return Err("Enter a valid domain".to_string());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now();
    conn.execute(
        "INSERT OR IGNORE INTO blocked_sites (domain, created_at) VALUES (?1, ?2)",
        rusqlite::params![domain, created_at],
    )
    .map_err(|e| e.to_string())?;
    let site = conn
        .query_row(
            &format!("SELECT {BLOCKED_SITE_COLUMNS} FROM blocked_sites WHERE domain = ?1"),
            rusqlite::params![domain],
            row_to_blocked_site,
        )
        .map_err(|e| e.to_string())?;

    if active_work_task_count(&conn) > 0 {
        hosts::apply_block(&list_blocked_domains(&conn));
    }
    Ok(site)
}

#[tauri::command]
pub fn remove_blocked_site(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM blocked_sites WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    if active_work_task_count(&conn) > 0 {
        hosts::apply_block(&list_blocked_domains(&conn));
    }
    Ok(())
}

#[tauri::command]
pub fn check_hosts_permission() -> bool {
    hosts::has_permission()
}

#[tauri::command]
pub fn grant_hosts_permission() -> Result<(), String> {
    hosts::grant_permission()
}

#[tauri::command]
pub fn open_dashboard(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("dashboard") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "dashboard", WebviewUrl::App("index.html".into()))
        .title("Focus — Dashboard")
        .inner_size(960.0, 680.0)
        .min_inner_size(720.0, 520.0)
        .resizable(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
