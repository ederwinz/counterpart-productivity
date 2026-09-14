import { Sparkles } from "lucide-react";
import { FocusTask, Task } from "../api";
import { formatDuration, minutesToday, minutesWorkedToday } from "../lib/stats";
import { Card, CardContent } from "./ui/card";

interface Props {
  tasks: Task[];
  goals: FocusTask[];
  byGoal: Map<number, Map<string, number>>;
}

export default function TodaySummary({ tasks, goals, byGoal }: Props) {
  const total = minutesWorkedToday(tasks);

  const goalBreakdown = goals
    .map((g) => ({ name: g.name, minutes: minutesToday(byGoal.get(g.id)) }))
    .filter((g) => g.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const taggedTotal = goalBreakdown.reduce((sum, g) => sum + g.minutes, 0);
  const generalMinutes = Math.max(0, total - taggedTotal);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-label text-xs uppercase text-muted-foreground">
              Focused today
            </p>
            <p className="font-display text-3xl font-medium tabular-nums tracking-tight text-foreground">
              {formatDuration(total)}
            </p>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No focus time logged yet today — start a session below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {goalBreakdown.map((g) => (
              <span
                key={g.name}
                className="font-label flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground"
              >
                {g.name}
                <span className="tabular-nums text-muted-foreground">{formatDuration(g.minutes)}</span>
              </span>
            ))}
            {generalMinutes > 0 && (
              <span className="font-label flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground">
                General
                <span className="tabular-nums text-muted-foreground">{formatDuration(generalMinutes)}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
