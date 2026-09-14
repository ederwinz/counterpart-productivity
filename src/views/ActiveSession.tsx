import { useEffect, useState } from "react";
import { Lock, Pause, Play } from "lucide-react";
import { Task, pauseTask, resumeTask, updateTaskStatus } from "../api";
import { Button } from "../components/ui/button";

interface Props {
  task: Task;
  onStopped: () => void;
}

function endMs(task: Task): number {
  return (
    new Date(task.scheduled_start).getTime() +
    task.duration_minutes * 60_000 +
    task.paused_seconds_total * 1000
  );
}

function remainingSeconds(task: Task): number {
  // While paused, freeze the countdown by measuring against the pause instant
  // instead of the real clock — resuming folds the elapsed pause into
  // paused_seconds_total, which pushes the end time forward by the same
  // amount, so the display picks up again from exactly this value.
  const reference = task.status === "paused" && task.paused_at ? new Date(task.paused_at).getTime() : Date.now();
  return Math.max(0, Math.round((endMs(task) - reference) / 1000));
}

export default function ActiveSession({ task, onStopped }: Props) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(task));
  const [stopping, setStopping] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const paused = task.status === "paused";

  useEffect(() => {
    setSeconds(remainingSeconds(task));
    if (paused) return;
    const id = setInterval(() => setSeconds(remainingSeconds(task)), 1000);
    return () => clearInterval(id);
  }, [task, paused]);

  async function handleStop() {
    setStopping(true);
    try {
      await updateTaskStatus(task.id, "skipped");
      onStopped();
    } finally {
      setStopping(false);
    }
  }

  async function handleTogglePause() {
    setTogglingPause(true);
    try {
      if (paused) {
        await resumeTask(task.id);
      } else {
        await pauseTask(task.id);
      }
      onStopped();
    } finally {
      setTogglingPause(false);
    }
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-stage p-6 text-center text-surface-stage-foreground">
      <p className="font-label flex items-center gap-1.5 text-xs uppercase text-surface-stage-border">
        {paused && <Pause className="size-3.5" aria-hidden="true" />}
        {paused ? "Paused" : task.is_break ? "Break" : "Focus Mode"}
      </p>
      <p
        className={`font-display text-5xl font-medium tabular-nums tracking-tight ${paused ? "opacity-50" : ""}`}
      >
        {mins}:{secs}
      </p>
      <p className="text-base text-surface-stage-foreground/80">{task.title}</p>
      {task.cycle_preset && task.cycle_round && (
        <p className="text-xs text-surface-stage-foreground/50">Round {task.cycle_round}</p>
      )}
      {paused && !task.is_break && (
        <p className="flex items-center gap-1.5 text-xs text-surface-stage-foreground/60">
          <Lock className="size-3.5" aria-hidden="true" />
          Blocked sites are still off-limits while paused
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {!task.is_break && (
          <Button
            variant="outline"
            onClick={handleTogglePause}
            disabled={togglingPause}
            className="border-surface-stage-foreground/20 text-surface-stage-foreground hover:bg-surface-stage-foreground/10 hover:text-surface-stage-foreground"
          >
            {paused ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleStop}
          disabled={stopping}
          className="border-surface-stage-foreground/20 text-surface-stage-foreground hover:bg-surface-stage-foreground/10 hover:text-surface-stage-foreground"
        >
          Stop session
        </Button>
      </div>
    </div>
  );
}
