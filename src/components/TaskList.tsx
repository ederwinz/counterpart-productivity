import { Trash2 } from "lucide-react";
import { Task, deleteTask } from "../api";

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
  async function handleDelete(id: number, taskTitle: string) {
    if (!window.confirm(`Remove "${taskTitle}"?`)) return;
    await deleteTask(id);
    onChanged();
  }

  const upcoming = tasks.filter((t) => t.status === "pending");
  const past = tasks.filter((t) => t.status === "completed" || t.status === "skipped");

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
              className="group flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-card"
            >
              <div>
                <p className="text-sm text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(t.scheduled_start)} · {t.duration_minutes} min
                </p>
              </div>
              <button
                onClick={() => handleDelete(t.id, t.title)}
                aria-label={`Remove ${t.title}`}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="font-label mb-2 mt-6 text-xs uppercase text-muted-foreground">Done</h2>
          <ul className="flex flex-col gap-1">
            {past.slice(0, 5).map((t) => (
              <li key={t.id} className="px-2 py-1.5">
                <p className="text-sm text-muted-foreground line-through">{t.title}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
