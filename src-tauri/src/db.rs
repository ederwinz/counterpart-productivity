use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub scheduled_start: DateTime<Utc>,
    pub duration_minutes: i64,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub focus_task_id: Option<i64>,
    pub is_break: bool,
    pub cycle_preset: Option<String>,
    pub cycle_work_minutes: Option<i64>,
    pub cycle_break_minutes: Option<i64>,
    pub cycle_long_break_minutes: Option<i64>,
    pub cycle_rounds_before_long_break: Option<i64>,
    pub cycle_round: Option<i64>,
    pub cycle_base_title: Option<String>,
    pub cycle_focus_task_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusTask {
    pub id: i64,
    pub name: String,
    pub daily_goal_minutes: i64,
    pub archived: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedSite {
    pub id: i64,
    pub domain: String,
    pub created_at: DateTime<Utc>,
}

pub fn init(app_data_dir: PathBuf) -> Connection {
    std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
    let db_path = app_data_dir.join("focus.sqlite");
    let conn = Connection::open(db_path).expect("failed to open sqlite db");
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT NOT NULL,
            scheduled_start TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            status          TEXT NOT NULL DEFAULT 'pending',
            created_at      TEXT NOT NULL
        )",
        [],
    )
    .expect("failed to create tasks table");

    // Migration: add focus_task_id to pre-existing installs.
    conn.execute("ALTER TABLE tasks ADD COLUMN focus_task_id INTEGER", [])
        .ok();

    // Migration: auto-cycling preset sessions (work/break chaining).
    conn.execute(
        "ALTER TABLE tasks ADD COLUMN is_break INTEGER NOT NULL DEFAULT 0",
        [],
    )
    .ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN cycle_preset TEXT", [])
        .ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN cycle_work_minutes INTEGER", [])
        .ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN cycle_break_minutes INTEGER", [])
        .ok();
    conn.execute(
        "ALTER TABLE tasks ADD COLUMN cycle_long_break_minutes INTEGER",
        [],
    )
    .ok();
    conn.execute(
        "ALTER TABLE tasks ADD COLUMN cycle_rounds_before_long_break INTEGER",
        [],
    )
    .ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN cycle_round INTEGER", [])
        .ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN cycle_base_title TEXT", [])
        .ok();
    conn.execute(
        "ALTER TABLE tasks ADD COLUMN cycle_focus_task_id INTEGER",
        [],
    )
    .ok();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS focus_tasks (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            name               TEXT NOT NULL,
            daily_goal_minutes INTEGER NOT NULL,
            archived           INTEGER NOT NULL DEFAULT 0,
            created_at         TEXT NOT NULL
        )",
        [],
    )
    .expect("failed to create focus_tasks table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS blocked_sites (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            domain     TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )",
        [],
    )
    .expect("failed to create blocked_sites table");

    conn
}

pub fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        scheduled_start: row.get(2)?,
        duration_minutes: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        focus_task_id: row.get(6)?,
        is_break: row.get::<_, i64>(7)? != 0,
        cycle_preset: row.get(8)?,
        cycle_work_minutes: row.get(9)?,
        cycle_break_minutes: row.get(10)?,
        cycle_long_break_minutes: row.get(11)?,
        cycle_rounds_before_long_break: row.get(12)?,
        cycle_round: row.get(13)?,
        cycle_base_title: row.get(14)?,
        cycle_focus_task_id: row.get(15)?,
    })
}

pub fn row_to_focus_task(row: &rusqlite::Row) -> rusqlite::Result<FocusTask> {
    Ok(FocusTask {
        id: row.get(0)?,
        name: row.get(1)?,
        daily_goal_minutes: row.get(2)?,
        archived: row.get::<_, i64>(3)? != 0,
        created_at: row.get(4)?,
    })
}

pub fn row_to_blocked_site(row: &rusqlite::Row) -> rusqlite::Result<BlockedSite> {
    Ok(BlockedSite {
        id: row.get(0)?,
        domain: row.get(1)?,
        created_at: row.get(2)?,
    })
}

pub const SELECT_COLUMNS: &str = "id, title, scheduled_start, duration_minutes, status, created_at, focus_task_id, \
     is_break, cycle_preset, cycle_work_minutes, cycle_break_minutes, cycle_long_break_minutes, \
     cycle_rounds_before_long_break, cycle_round, cycle_base_title, cycle_focus_task_id";

pub fn active_work_task_count(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'active' AND is_break = 0",
        [],
        |r| r.get(0),
    )
    .unwrap_or(0)
}

pub const FOCUS_TASK_COLUMNS: &str = "id, name, daily_goal_minutes, archived, created_at";

pub const BLOCKED_SITE_COLUMNS: &str = "id, domain, created_at";

pub fn list_blocked_domains(conn: &Connection) -> Vec<String> {
    let mut stmt = match conn.prepare(&format!("SELECT {BLOCKED_SITE_COLUMNS} FROM blocked_sites"))
    {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    stmt.query_map([], row_to_blocked_site)
        .map(|rows| rows.filter_map(Result::ok).map(|s| s.domain).collect())
        .unwrap_or_default()
}
