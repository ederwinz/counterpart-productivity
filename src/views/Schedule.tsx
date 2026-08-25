import { useEffect, useState } from "react";
import { LayoutDashboard, Trash2 } from "lucide-react";
import { FocusTask, Task, deleteTask, listFocusTasks, openDashboard } from "../api";
import { Button } from "../components/ui/button";
import TaskForm from "../components/TaskForm";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

interface Props {
  tasks: Task[];
  onTasksChanged: () => void;
}

export default function Schedule({ tasks, onTasksChanged }: Props) {
  const [goals, setGoals] = useState<FocusTask[]>([]);

  useEffect(() => {
    listFocusTasks().then((all) => setGoals(all.filter((g) => !g.archived)));
  }, []);

  async function handleDelete(id: number, taskTitle: string) {
    if (!window.confirm(`Remove "${taskTitle}"?`)) return;
    await deleteTask(id);
    onTasksChanged();
  }

  const upcoming = tasks.filter((t) => t.status === "pending");
  const past = tasks.filter((t) => t.status === "completed" || t.status === "skipped");

  return (
    <div className="flex h-full flex-col gap-6 bg-background p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium">Focus</h1>
          <p className="text-sm text-muted-foreground">Schedule time, and it starts itself.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openDashboard()}>
          <LayoutDashboard className="size-3.5" aria-hidden="true" />
          Dashboard
        </Button>
      </div>

      <TaskForm goals={goals} onCreated={onTasksChanged} />

      <div className="flex-1 overflow-y-auto">
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
    </div>
  );
}
