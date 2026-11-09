import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, SkipForward } from "lucide-react";
import { FocusTask, Task, listFocusTasks, listTasks } from "../api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { addDays, dateKey, formatDuration, keyToDate, sessionsByDay } from "../lib/stats";

function initialDay(): string {
  const param = new URLSearchParams(window.location.search).get("day");
  return param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : dateKey(new Date().toISOString());
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface GoalRow {
  name: string;
  minutes: number;
  goalMinutes: number | null;
}

export default function DayDetail() {
  const [day, setDay] = useState(initialDay);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<FocusTask[]>([]);
  const today = dateKey(new Date().toISOString());

  const refresh = useCallback(() => {
    listTasks().then(setTasks);
    // Archived goals included on purpose: past sessions keep their goal's name.
    listFocusTasks().then(setGoals);
  }, []);

  useEffect(() => {
    refresh();
    const unlisteners = [
      listen<string>("day-selected", (e) => setDay(e.payload)),
      listen("task-created", refresh),
      listen("task-started", refresh),
      listen("task-completed", refresh),
      listen("task-updated", refresh),
    ];
    return () => unlisteners.forEach((u) => u.then((f) => f()));
  }, [refresh]);

  const date = keyToDate(day);
  useEffect(() => {
    const short = keyToDate(day).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    getCurrentWindow().setTitle(`Counterpart — ${short}`);
  }, [day]);

  const isToday = day === today;
  const go = useCallback(
    (step: number) => setDay((d) => (step > 0 && d >= today ? d : addDays(d, step))),
    [today],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const sessions = useMemo(() => sessionsByDay(tasks).get(day) ?? [], [tasks, day]);
  const completed = sessions.filter((t) => t.status === "completed");
  const totalMinutes = completed.reduce((sum, t) => sum + t.duration_minutes, 0);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const goalRows = useMemo<GoalRow[]>(() => {
    const byGoal = new Map<number | null, number>();
    for (const t of completed) {
      const id = t.focus_task_id != null && goalById.has(t.focus_task_id) ? t.focus_task_id : null;
      byGoal.set(id, (byGoal.get(id) ?? 0) + t.duration_minutes);
    }
    const rows: GoalRow[] = [];
    let general = 0;
    for (const [id, minutes] of byGoal) {
      const goal = id == null ? undefined : goalById.get(id);
      if (!goal) general += minutes;
      else rows.push({ name: goal.name, minutes, goalMinutes: goal.daily_goal_minutes });
    }
    rows.sort((a, b) => b.minutes - a.minutes);
    if (general > 0) rows.push({ name: "General", minutes: general, goalMinutes: null });
    return rows;
  }, [completed, goalById]);
  const maxGoalMinutes = Math.max(1, ...goalRows.map((r) => r.minutes));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous day">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="text-lg font-semibold">
              {date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </h1>
            <p className="font-label text-xs uppercase text-muted-foreground">
              {isToday ? "Today" : date.getFullYear()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go(1)}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <dl className="grid grid-cols-2 gap-6">
          <BigStat value={formatDuration(totalMinutes)} label="Focused" />
          <BigStat
            value={String(completed.length)}
            label={completed.length === 1 ? "Session" : "Sessions"}
          />
        </dl>

        {sessions.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isToday
                  ? "No focus sessions yet today."
                  : "No focus sessions on this day."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {goalRows.length > 0 && (
              <section>
                <h2 className="font-label mb-3 text-xs uppercase text-muted-foreground">By goal</h2>
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    {goalRows.map((row) => {
                      const met = row.goalMinutes != null && row.minutes >= row.goalMinutes;
                      return (
                        <div key={row.name} className="flex flex-col gap-1.5">
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm text-foreground" title={row.name}>
                              {row.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              {met && (
                                <span className="font-label flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase text-primary-hover">
                                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                                  Goal met
                                </span>
                              )}
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {formatDuration(row.minutes)}
                                {row.goalMinutes != null && ` / ${formatDuration(row.goalMinutes)}`}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                            <div
                              className={`h-full rounded-full ${row.goalMinutes == null ? "bg-muted-foreground/50" : "bg-primary"}`}
                              style={{ width: `${(row.minutes / maxGoalMinutes) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </section>
            )}

            <section>
              <h2 className="font-label mb-3 text-xs uppercase text-muted-foreground">Sessions</h2>
              <Card>
                <CardContent>
                  <ol className="flex flex-col">
                    {sessions.map((t) => (
                      <SessionRow
                        key={t.id}
                        task={t}
                        goalName={t.focus_task_id != null ? goalById.get(t.focus_task_id)?.name : undefined}
                      />
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-1">
      <dt className="font-label text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="font-display text-5xl font-semibold tabular-nums tracking-[-0.03em] text-foreground">
        {value}
      </dd>
    </div>
  );
}

function SessionRow({ task, goalName }: { task: Task; goalName: string | undefined }) {
  const completed = task.status === "completed";
  const skipped = task.status === "skipped";
  const Icon = completed ? CheckCircle2 : skipped ? SkipForward : CircleDot;

  return (
    <li className="flex items-center gap-3 border-b border-foreground/10 py-2.5 last:border-b-0">
      <span className="font-label w-[4.75rem] shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {formatTime(task.scheduled_start)}
      </span>
      <Icon
        className={`size-3.5 shrink-0 ${completed ? "text-primary" : skipped ? "text-muted-foreground" : "text-accent"}`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`truncate text-sm ${completed ? "text-foreground" : "text-muted-foreground"}`}
          title={task.title}
        >
          {task.title}
        </span>
        {goalName && goalName.trim().toLowerCase() !== task.title.trim().toLowerCase() && (
          <span className="font-label shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-foreground">
            {goalName}
          </span>
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {completed
          ? formatDuration(task.duration_minutes)
          : skipped
            ? "Stopped early"
            : "In progress"}
      </span>
    </li>
  );
}
