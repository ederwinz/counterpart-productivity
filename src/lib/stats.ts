import { Task } from "../api";

export function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function todayKey(): string {
  return dateKey(new Date().toISOString());
}

/** Minutes of completed focus time per goal, per day. */
export function minutesByGoalAndDay(tasks: Task[]): Map<number, Map<string, number>> {
  const result = new Map<number, Map<string, number>>();
  for (const t of tasks) {
    if (t.status !== "completed" || t.focus_task_id == null) continue;
    const key = dateKey(t.scheduled_start);
    let byDay = result.get(t.focus_task_id);
    if (!byDay) {
      byDay = new Map();
      result.set(t.focus_task_id, byDay);
    }
    byDay.set(key, (byDay.get(key) ?? 0) + t.duration_minutes);
  }
  return result;
}

export function minutesToday(byDay: Map<string, number> | undefined): number {
  return byDay?.get(todayKey()) ?? 0;
}

/**
 * Total completed work minutes today, goal-tagged or not — breaks excluded via
 * is_break rather than focus_task_id, since an untagged work session and a break
 * both have a null focus_task_id.
 */
export function minutesWorkedToday(tasks: Task[]): number {
  const today = todayKey();
  let total = 0;
  for (const t of tasks) {
    if (t.status !== "completed" || t.is_break) continue;
    if (dateKey(t.scheduled_start) !== today) continue;
    total += t.duration_minutes;
  }
  return total;
}

/** "5h 20m" / "45m" / "0m" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

/** Last `days` day-keys, oldest first, ending today. */
export function recentDayKeys(days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d.toISOString()));
  }
  return keys;
}

/** Consecutive days (ending today or yesterday) where the daily goal was met. */
export function currentStreak(byDay: Map<string, number> | undefined, goalMinutes: number): number {
  if (!byDay || goalMinutes <= 0) return 0;
  let streak = 0;
  const d = new Date();
  // If today's goal isn't met yet, start counting from yesterday so an
  // in-progress day doesn't zero out an otherwise-live streak.
  if ((byDay.get(dateKey(d.toISOString())) ?? 0) < goalMinutes) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const key = dateKey(d.toISOString());
    const minutes = byDay.get(key) ?? 0;
    if (minutes < goalMinutes) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
