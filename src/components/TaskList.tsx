import { useState } from "react";
import { Check, CheckCircle2, SkipForward, Trash2, X } from "lucide-react";
import { Task, deleteTask } from "../api";

const DONE_LIMIT = 5;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

interface Props {
  tasks: Task[];
  onChanged: () => void;
}

export default function TaskList({ tasks, onChanged }: Props) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setConfirmingId(null);
    await deleteTask(id);
    onChanged();
  }

  const upcoming = tasks.filter((t) => t.status === "pending");
  const past = tasks.filter((t) => t.status === "completed" || t.status === "skipped").reverse();
  const hiddenCount = past.length - DONE_LIMIT;

  return (
    <div>
      <h2 className="font-label mb-2 text-xs uppercase text-muted-foreground">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {upcoming.map((t) => (
            <li
              key={t.id}
              className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:bg-card"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{t.title}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatWhen(t.scheduled_start)} · {t.duration_minutes} min
                </p>
              </div>
              {confirmingId === t.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-muted-foreground">Remove?</span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Confirm: remove ${t.title}`}
                    className="rounded-md p-1 text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    aria-label="Cancel"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(t.id)}
                  aria-label={`Remove ${t.title}`}
                  className="hover-reveal-icon shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="font-label mb-2 mt-6 text-xs uppercase text-muted-foreground">Done</h2>
          <ul className="flex flex-col gap-1">
            {past.slice(0, DONE_LIMIT).map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-2 py-1.5">
                {t.status === "completed" ? (
                  <>
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm text-foreground/70 line-through">
                      <span className="sr-only">Completed: </span>
                      {t.title}
                    </p>
                  </>
                ) : (
                  <>
                    <SkipForward className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      <span className="sr-only">Stopped early: </span>
                      {t.title}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <p className="font-label mt-1 px-2 text-xs uppercase text-muted-foreground">
              +{hiddenCount} more
            </p>
          )}
        </>
      )}
    </div>
  );
}
