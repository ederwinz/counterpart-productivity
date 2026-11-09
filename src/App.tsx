import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Task, listTasks } from "./api";
import ActiveSession from "./views/ActiveSession";
import Dashboard from "./views/Dashboard";
import DayDetail from "./views/DayDetail";

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
    const unlistenUpdated = listen("task-updated", refresh);
    return () => {
      unlistenCreated.then((f) => f());
      unlistenStarted.then((f) => f());
      unlistenCompleted.then((f) => f());
      unlistenUpdated.then((f) => f());
    };
  }, [refresh]);

  const label = getCurrentWindow().label;
  const active = tasks.find((t) => t.status === "active" || t.status === "paused");

  // The "main" popover only ever shows the live countdown. Once a session ends
  // while it's on screen, there's nothing left for it to show — hide it rather
  // than stranding the user on an empty view (clicking the tray icon reopens
  // the Dashboard instead when nothing is active).
  useEffect(() => {
    if (label === "main" && !active && tasks.length > 0) {
      getCurrentWindow().hide();
    }
  }, [label, active, tasks.length]);

  if (label === "dashboard") {
    return <Dashboard />;
  }
  if (label === "day") {
    return <DayDetail />;
  }

  return (
    <div className="h-screen bg-background">
      {active && <ActiveSession task={active} onStopped={refresh} />}
    </div>
  );
}
