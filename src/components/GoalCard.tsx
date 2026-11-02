import { Check, Flame } from "lucide-react";
import { FocusTask } from "../api";
import { useReducedMotion } from "../hooks/use-reduced-motion";
import { currentStreak, minutesToday, recentDayKeys } from "../lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

function weekdayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "narrow" });
}

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface Props {
  goal: FocusTask;
  byDay: Map<string, number> | undefined;
}

export default function GoalCard({ goal, byDay }: Props) {
  const reducedMotion = useReducedMotion();
  const today = minutesToday(byDay);
  const pct = Math.min(100, Math.round((today / Math.max(1, goal.daily_goal_minutes)) * 100));
  const ringOffset = RING_CIRCUMFERENCE * (1 - pct / 100);
  const streak = currentStreak(byDay, goal.daily_goal_minutes);
  const days = recentDayKeys(7);
  const maxRecent = Math.max(goal.daily_goal_minutes, ...days.map((k) => byDay?.get(k) ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{goal.name}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Goal: {goal.daily_goal_minutes} min / day
          </p>
        </div>
        {streak > 0 && (
          <span
            className="font-label flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-1 text-xs text-secondary-hover"
            aria-label={`${streak} day streak`}
          >
            <Flame className="size-3.5" aria-hidden="true" />
            {streak}d
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div
          className="flex items-center gap-4"
          role="img"
          aria-label={`Today: ${today} of ${goal.daily_goal_minutes} minutes, ${pct}% of goal`}
        >
          <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
            <circle
              cx="38"
              cy="38"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="7"
              className="text-muted"
              stroke="currentColor"
            />
            <circle
              cx="38"
              cy="38"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              className={`text-primary ${reducedMotion ? "" : "transition-[stroke-dashoffset] duration-500 [transition-timing-function:var(--ease-out)]"}`}
              stroke="currentColor"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
            <text
              x="38"
              y="38"
              fill="currentColor"
              className="rotate-90 font-display text-[1.1rem] font-medium text-foreground"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ transformOrigin: "38px 38px" }}
            >
              {pct}%
            </text>
          </svg>
          <div>
            <p className="font-label text-xs uppercase text-muted-foreground">Today</p>
            <p className="mt-0.5 text-lg font-medium tabular-nums text-foreground">
              {today} <span className="text-sm font-normal text-muted-foreground">/ {goal.daily_goal_minutes} min</span>
            </p>
          </div>
        </div>

        <div
          className="flex h-14 items-end gap-1.5"
          role="img"
          aria-label={`Last 7 days: ${days
            .map((key) => {
              const m = byDay?.get(key) ?? 0;
              const met = m >= goal.daily_goal_minutes && goal.daily_goal_minutes > 0;
              return `${m} minutes${met ? " (goal met)" : ""}`;
            })
            .join(", ")}`}
        >
          {days.map((key) => {
            const minutes = byDay?.get(key) ?? 0;
            const met = minutes >= goal.daily_goal_minutes && goal.daily_goal_minutes > 0;
            const height = Math.max(6, Math.round((minutes / maxRecent) * 100));
            return (
              <div key={key} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`font-label flex h-3 items-center gap-0.5 text-[9px] tabular-nums ${met ? "text-primary" : "text-muted-foreground/70"}`}
                >
                  {met && <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />}
                  {minutes > 0 ? minutes : ""}
                </span>
                <div className="flex h-9 w-full items-end">
                  <div
                    className={`w-full rounded-full ${met ? "bg-primary" : "bg-muted"}`}
                    style={{ height: `${height}%` }}
                    title={`${minutes} min`}
                  />
                </div>
                <span
                  className={`text-[10px] ${met ? "font-semibold text-foreground" : "text-muted-foreground/70"}`}
                >
                  {weekdayLabel(key)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
