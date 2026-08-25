import { useEffect, useState } from "react";
import { Task, updateTaskStatus } from "../api";
import { Button } from "../components/ui/button";

interface Props {
  task: Task;
  onStopped: () => void;
}

function remainingSeconds(task: Task): number {
  const end = new Date(task.scheduled_start).getTime() + task.duration_minutes * 60_000;
  return Math.max(0, Math.round((end - Date.now()) / 1000));
}

export default function ActiveSession({ task, onStopped }: Props) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(task));
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    setSeconds(remainingSeconds(task));
    const id = setInterval(() => setSeconds(remainingSeconds(task)), 1000);
    return () => clearInterval(id);
  }, [task]);

  async function handleStop() {
    setStopping(true);
    try {
      await updateTaskStatus(task.id, "skipped");
      onStopped();
    } finally {
      setStopping(false);
    }
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-stage p-6 text-center text-surface-stage-foreground">
      <p className="font-label text-xs uppercase text-surface-stage-border">
        {task.is_break ? "Break" : "Focus Mode"}
      </p>
      <p className="font-display text-5xl font-medium tabular-nums tracking-tight">
        {mins}:{secs}
      </p>
      <p className="text-base text-surface-stage-foreground/80">{task.title}</p>
      {task.cycle_preset && task.cycle_round && (
        <p className="text-xs text-surface-stage-foreground/50">Round {task.cycle_round}</p>
      )}
      <Button
        variant="outline"
        onClick={handleStop}
        disabled={stopping}
        className="mt-2 border-surface-stage-foreground/20 text-surface-stage-foreground hover:bg-surface-stage-foreground/10 hover:text-surface-stage-foreground"
      >
        Stop session
      </Button>
    </div>
  );
}
