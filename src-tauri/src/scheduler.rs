use crate::db::{active_work_task_count, list_blocked_domains, row_to_task, Db, SELECT_COLUMNS};
use crate::hosts;
use chrono::{Duration, Utc};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

const TICK: std::time::Duration = std::time::Duration::from_secs(1);

/// Reconciles /etc/hosts blocking against the DB's actual active-task state.
/// Needed because blocking is otherwise only cleared reactively by a status
/// transition inside a running process — if the app is killed while a task
/// is active (crash, force-quit, dev rebuild), that clear never fires and
/// the block would otherwise persist forever across restarts.
pub fn reconcile(app: &AppHandle) {
    let db = app.state::<Db>();
    let conn = db.0.lock().expect("db lock poisoned");
    if active_work_task_count(&conn) > 0 {
        hosts::apply_block(&list_blocked_domains(&conn));
    } else {
        hosts::clear_block();
    }
}

pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(TICK);
        loop {
            interval.tick().await;
            tick(&app);
        }
    });
}

fn tick(app: &AppHandle) {
    let db = app.state::<Db>();
    let now = Utc::now();

    let started: Vec<crate::db::Task> = {
        let conn = db.0.lock().expect("db lock poisoned");
        let mut stmt = conn
            .prepare(&format!(
                "SELECT {SELECT_COLUMNS} FROM tasks WHERE status = 'pending' AND scheduled_start <= ?1"
            ))
            .expect("prepare failed");
        let due: Vec<_> = stmt
            .query_map(rusqlite::params![now], row_to_task)
            .expect("query failed")
            .filter_map(Result::ok)
            .collect();
        for task in &due {
            conn.execute(
                "UPDATE tasks SET status = 'active' WHERE id = ?1",
                rusqlite::params![task.id],
            )
            .ok();
        }
        due
    };

    for task in &started {
        if task.is_break {
            notify(app, "Break time", &task.title);
        } else {
            notify(app, "Focus session started", &task.title);
        }
        let _ = app.emit("task-started", task.id);
    }

    let completed: Vec<crate::db::Task> = {
        let conn = db.0.lock().expect("db lock poisoned");
        let mut stmt = conn
            .prepare(&format!(
                "SELECT {SELECT_COLUMNS} FROM tasks WHERE status = 'active'"
            ))
            .expect("prepare failed");
        let active: Vec<_> = stmt
            .query_map([], row_to_task)
            .expect("query failed")
            .filter_map(Result::ok)
            .collect();
        let mut done = Vec::new();
        for task in &active {
            let end = task.scheduled_start + Duration::minutes(task.duration_minutes);
            if now >= end {
                conn.execute(
                    "UPDATE tasks SET status = 'completed' WHERE id = ?1",
                    rusqlite::params![task.id],
                )
                .ok();
                done.push(task.clone());
            }
        }

        for task in &done {
            chain_next(&conn, task, now);
        }

        done
    };

    {
        let conn = db.0.lock().expect("db lock poisoned");
        if active_work_task_count(&conn) > 0 {
            hosts::apply_block(&list_blocked_domains(&conn));
        } else {
            hosts::clear_block();
        }
    }

    for task in &completed {
        notify(app, "Focus session complete", &task.title);
        let _ = app.emit("task-completed", task.id);
    }

    update_tray(app, &db, now);
}

/// If a just-completed task is part of an auto-cycling preset, insert the next
/// pending task in the cycle (break after work, next work round after a break).
/// The new row goes in as `pending` with `scheduled_start = now`, so the normal
/// "due" query above picks it up on the very next tick — no duplicated
/// active/notify/tray/block logic needed here.
fn chain_next(conn: &rusqlite::Connection, task: &crate::db::Task, now: chrono::DateTime<Utc>) {
    let Some(preset) = &task.cycle_preset else {
        return;
    };
    let base_title = task.cycle_base_title.clone().unwrap_or_else(|| task.title.clone());
    let cycle_focus_task_id = task.cycle_focus_task_id;

    let (title, duration_minutes, is_break, focus_task_id, cycle_round) = if !task.is_break {
        let round = task.cycle_round.unwrap_or(1);
        let is_long_break = task
            .cycle_rounds_before_long_break
            .map(|n| n > 0 && round % n == 0)
            .unwrap_or(false);
        let break_minutes = if is_long_break {
            task.cycle_long_break_minutes.unwrap_or(task.cycle_break_minutes.unwrap_or(5))
        } else {
            task.cycle_break_minutes.unwrap_or(5)
        };
        (format!("{base_title} — Break"), break_minutes, true, None, round)
    } else {
        let round = task.cycle_round.unwrap_or(1) + 1;
        (
            base_title.clone(),
            task.cycle_work_minutes.unwrap_or(25),
            false,
            cycle_focus_task_id,
            round,
        )
    };

    conn.execute(
        "INSERT INTO tasks (
            title, scheduled_start, duration_minutes, status, created_at, focus_task_id,
            is_break, cycle_preset, cycle_work_minutes, cycle_break_minutes,
            cycle_long_break_minutes, cycle_rounds_before_long_break, cycle_round,
            cycle_base_title, cycle_focus_task_id
        ) VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        rusqlite::params![
            title,
            now,
            duration_minutes,
            now,
            focus_task_id,
            is_break as i64,
            preset,
            task.cycle_work_minutes,
            task.cycle_break_minutes,
            task.cycle_long_break_minutes,
            task.cycle_rounds_before_long_break,
            cycle_round,
            base_title,
            cycle_focus_task_id,
        ],
    )
    .ok();
}

fn notify(app: &AppHandle, title: &str, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

fn update_tray(app: &AppHandle, db: &Db, now: chrono::DateTime<Utc>) {
    let active = {
        let conn = db.0.lock().expect("db lock poisoned");
        conn.query_row(
            &format!("SELECT {SELECT_COLUMNS} FROM tasks WHERE status = 'active' LIMIT 1"),
            [],
            row_to_task,
        )
        .ok()
    };

    let Some(tray) = app.tray_by_id("main") else {
        return;
    };

    match active {
        Some(task) => {
            let end = task.scheduled_start + Duration::minutes(task.duration_minutes);
            let remaining = (end - now).num_seconds().max(0);
            let mins = remaining / 60;
            let secs = remaining % 60;
            let _ = tray.set_title(Some(format!("{mins:02}:{secs:02}")));
        }
        None => {
            let _ = tray.set_title(Some(""));
        }
    }
}
