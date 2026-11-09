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
  return minutesByDay(tasks).get(todayKey()) ?? 0;
}

/** Completed work minutes per day, goal-tagged or not (breaks excluded). */
export function minutesByDay(tasks: Task[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "completed" || t.is_break) continue;
    const key = dateKey(t.scheduled_start);
    result.set(key, (result.get(key) ?? 0) + t.duration_minutes);
  }
  return result;
}

/**
 * Work sessions per day that actually ran (completed, stopped early, or in
 * progress), oldest first. Breaks and never-started pending rows excluded.
 */
export function sessionsByDay(tasks: Task[]): Map<string, Task[]> {
  const result = new Map<string, Task[]>();
  const ran = tasks
    .filter((t) => !t.is_break && t.status !== "pending")
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  for (const t of ran) {
    const key = dateKey(t.scheduled_start);
    const list = result.get(key);
    if (list) list.push(t);
    else result.set(key, [t]);
  }
  return result;
}

/** Fixed heatmap buckets, so a shade always means the same amount of work. */
export const HEAT_LEVELS = ["No focus", "Under 1h", "1–2h", "2–4h", "4h or more"] as const;

export function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 60) return 1;
  if (minutes < 120) return 2;
  if (minutes < 240) return 3;
  return 4;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d.toISOString());
}

export interface HeatmapWeeks {
  /** Columns of 7 day-keys, Sunday first; days after today are null. */
  weeks: (string | null)[][];
  /** Month abbreviations, keyed by the column where that month's 1st falls. */
  monthLabels: { column: number; label: string }[];
}

/** Week columns from the week containing `firstKey` through the current week. */
export function heatmapWeeks(firstKey: string, today: string = todayKey()): HeatmapWeeks {
  const start = keyToDate(firstKey);
  start.setDate(start.getDate() - start.getDay());
  const weeks: (string | null)[][] = [];
  const monthLabels: { column: number; label: string }[] = [];
  const cursor = new Date(start);
  while (dateKey(cursor.toISOString()) <= today) {
    const column: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const key = dateKey(cursor.toISOString());
      column.push(key <= today ? key : null);
      if (cursor.getDate() === 1 || (weeks.length === 0 && i === 0)) {
        monthLabels.push({
          column: weeks.length,
          label: cursor.toLocaleDateString([], { month: "short" }),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(column);
  }
  // The very first column gets a label even mid-month; drop it if the next
  // month starts one column later, or the two labels would overlap.
  if (monthLabels.length > 1 && monthLabels[1].column - monthLabels[0].column < 2) {
    monthLabels.shift();
  }
  return { weeks, monthLabels };
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
