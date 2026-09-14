import { invoke } from "@tauri-apps/api/core";

export type TaskStatus = "pending" | "active" | "paused" | "completed" | "skipped";

export interface Task {
  id: number;
  title: string;
  scheduled_start: string; // ISO datetime, UTC
  duration_minutes: number;
  status: TaskStatus;
  created_at: string;
  focus_task_id: number | null;
  is_break: boolean;
  cycle_preset: string | null;
  cycle_round: number | null;
  cycle_rounds_before_long_break: number | null;
  paused_at: string | null;
  paused_seconds_total: number;
}

export interface PresetDef {
  key: string;
  label: string;
  work_minutes: number;
  break_minutes: number;
  long_break_minutes: number | null;
  rounds_before_long_break: number | null;
  description: string;
}

export interface FocusTask {
  id: number;
  name: string;
  daily_goal_minutes: number;
  archived: boolean;
  created_at: string;
}

export interface BlockedSite {
  id: number;
  domain: string;
  created_at: string;
}

export interface CustomPreset {
  id: number;
  label: string;
  work_minutes: number;
  break_minutes: number;
  created_at: string;
}

export function listTasks(): Promise<Task[]> {
  return invoke("list_tasks");
}

export function createTask(
  title: string,
  scheduledStart: Date,
  durationMinutes: number,
  focusTaskId: number | null = null,
): Promise<Task> {
  return invoke("create_task", {
    title,
    scheduledStart: scheduledStart.toISOString(),
    durationMinutes,
    focusTaskId,
  });
}

export function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

export function updateTaskStatus(id: number, status: TaskStatus): Promise<void> {
  return invoke("update_task_status", { id, status });
}

export function pauseTask(id: number): Promise<void> {
  return invoke("pause_task", { id });
}

export function resumeTask(id: number): Promise<void> {
  return invoke("resume_task", { id });
}

export function listFocusTasks(): Promise<FocusTask[]> {
  return invoke("list_focus_tasks");
}

export function createFocusTask(name: string, dailyGoalMinutes: number): Promise<FocusTask> {
  return invoke("create_focus_task", { name, dailyGoalMinutes });
}

export function archiveFocusTask(id: number): Promise<void> {
  return invoke("archive_focus_task", { id });
}

export function listBlockedSites(): Promise<BlockedSite[]> {
  return invoke("list_blocked_sites");
}

export function addBlockedSite(domain: string): Promise<BlockedSite> {
  return invoke("add_blocked_site", { domain });
}

export function removeBlockedSite(id: number): Promise<void> {
  return invoke("remove_blocked_site", { id });
}

export function checkHostsPermission(): Promise<boolean> {
  return invoke("check_hosts_permission");
}

export function grantHostsPermission(): Promise<void> {
  return invoke("grant_hosts_permission");
}

export function openDashboard(): Promise<void> {
  return invoke("open_dashboard");
}

export function listPresets(): Promise<PresetDef[]> {
  return invoke("list_presets");
}

export function startPresetSession(
  presetKey: string,
  title: string,
  focusTaskId: number | null = null,
): Promise<Task> {
  return invoke("start_preset_session", {
    presetKey,
    title,
    focusTaskId,
  });
}

export function listCustomPresets(): Promise<CustomPreset[]> {
  return invoke("list_custom_presets");
}

export function createCustomPreset(
  label: string,
  workMinutes: number,
  breakMinutes: number,
): Promise<CustomPreset> {
  return invoke("create_custom_preset", { label, workMinutes, breakMinutes });
}

export function deleteCustomPreset(id: number): Promise<void> {
  return invoke("delete_custom_preset", { id });
}

export function startCustomSession(
  workMinutes: number,
  breakMinutes: number,
  title: string,
  focusTaskId: number | null = null,
): Promise<Task> {
  return invoke("start_custom_session", {
    workMinutes,
    breakMinutes,
    title,
    focusTaskId,
  });
}
