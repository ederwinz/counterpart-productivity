import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Task, listTasks } from "./api";
import Schedule from "./views/Schedule";
import ActiveSession from "./views/ActiveSession";
import Dashboard from "./views/Dashboard";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const refresh = useCallback(() => {
    listTasks().then(setTasks);
  }, []);

  useEffect(() => {
    refresh();
    const unlistenCreated = listen("task-created", refresh);
    const unlistenStarted = listen("task-started", refresh);
    const unlistenCompleted = listen("task-completed", refresh);
    return () => {
      unlistenCreated.then((f) => f());
      unlistenStarted.then((f) => f());
      unlistenCompleted.then((f) => f());
    };
  }, [refresh]);

  if (getCurrentWindow().label === "dashboard") {
    return <Dashboard />;
  }

  const active = tasks.find((t) => t.status === "active");

  return (
    <div className="h-screen bg-background">
      {active ? (
        <ActiveSession task={active} onStopped={refresh} />
      ) : (
        <Schedule tasks={tasks} onTasksChanged={refresh} />
      )}
    </div>
  );
}
