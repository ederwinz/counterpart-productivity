import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Task, listTasks } from "./api";
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

  const isDashboard = getCurrentWindow().label === "dashboard";
  const active = tasks.find((t) => t.status === "active");

  // The "main" popover only ever shows the live countdown. Once a session ends
  // while it's on screen, there's nothing left for it to show — hide it rather
  // than stranding the user on an empty view (clicking the tray icon reopens
  // the Dashboard instead when nothing is active).
  useEffect(() => {
    if (!isDashboard && !active && tasks.length > 0) {
      getCurrentWindow().hide();
    }
  }, [isDashboard, active, tasks.length]);

  if (isDashboard) {
    return <Dashboard />;
  }

  return (
    <div className="h-screen bg-background">
      {active && <ActiveSession task={active} onStopped={refresh} />}
    </div>
  );
}
