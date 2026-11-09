import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Plus } from "lucide-react";
import {
  AllowedSite,
  BlockedSite,
  BlockingMode,
  FocusTask,
  Task,
  addAllowedSite,
  addBlockedSite,
  checkHostsPermission,
  createFocusTask,
  getBlockingMode,
  grantHostsPermission,
  listAllowedSites,
  listBlockedSites,
  listFocusTasks,
  listTasks,
  removeAllowedSite,
  removeBlockedSite,
  setBlockingMode as setBlockingModeApi,
} from "../api";
import GoalCard from "../components/GoalCard";
import BlockedSitesPanel from "../components/BlockedSitesPanel";
import FeedbackForm from "../components/FeedbackForm";
import FocusHeatmap from "../components/FocusHeatmap";
import TaskForm from "../components/TaskForm";
import TaskList from "../components/TaskList";
import TodaySummary from "../components/TodaySummary";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { minutesByGoalAndDay } from "../lib/stats";

export default function Dashboard() {
  const [goals, setGoals] = useState<FocusTask[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [allowedSites, setAllowedSites] = useState<AllowedSite[]>([]);
  const [blockingMode, setBlockingModeState] = useState<BlockingMode>("blocklist");
  // Defaults to false (fail-closed) so the permission banner never flashes hidden
  // for a frame while checkHostsPermission() is still resolving.
  const [hasPermission, setHasPermission] = useState(false);
  const [granting, setGranting] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);

  const refresh = useCallback(() => {
    listFocusTasks().then((all) => setGoals(all.filter((g) => !g.archived)));
    listTasks().then(setTasks);
    listBlockedSites().then(setSites);
    listAllowedSites().then(setAllowedSites);
    getBlockingMode().then(setBlockingModeState);
    checkHostsPermission().then(setHasPermission);
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

  const byGoal = useMemo(() => minutesByGoalAndDay(tasks), [tasks]);

  async function handleGrantPermission() {
    setGranting(true);
    try {
      await grantHostsPermission();
      setHasPermission(await checkHostsPermission());
    } catch {
      // user declined the prompt or it failed — leave banner up so they can retry
    } finally {
      setGranting(false);
    }
  }

  async function handleAddSite(domain: string) {
    await addBlockedSite(domain);
    setSites(await listBlockedSites());
  }

  async function handleRemoveSite(id: number) {
    await removeBlockedSite(id);
    setSites(await listBlockedSites());
  }

  async function handleAddAllowedSite(domain: string) {
    await addAllowedSite(domain);
    setAllowedSites(await listAllowedSites());
  }

  async function handleRemoveAllowedSite(id: number) {
    await removeAllowedSite(id);
    setAllowedSites(await listAllowedSites());
  }

  async function handleSetBlockingMode(mode: BlockingMode) {
    setBlockingModeState(mode);
    await setBlockingModeApi(mode);
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track daily progress on your goals and manage focus-mode site blocking.
          </p>
        </header>

        <section>
          <FocusHeatmap tasks={tasks} />
        </section>

        <section>
          <TodaySummary tasks={tasks} goals={goals} byGoal={byGoal} />
        </section>

        <section>
          <h2 className="font-label mb-3 text-xs uppercase text-muted-foreground">Schedule</h2>
          <Card>
            <TaskForm goals={goals} onCreated={refresh} />
          </Card>
          <div className="mt-4">
            <TaskList tasks={tasks} onChanged={refresh} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-label text-xs uppercase text-muted-foreground">Goals</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowNewGoal((v) => !v)}>
              {!showNewGoal && <Plus className="size-3.5" aria-hidden="true" />}
              {showNewGoal ? "Cancel" : "New goal"}
            </Button>
          </div>

          {showNewGoal && (
            <NewGoalForm
              onCreate={async (name, minutes) => {
                await createFocusTask(name, minutes);
                setShowNewGoal(false);
                refresh();
              }}
            />
          )}

          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No goals yet. Add one to start tracking daily progress.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} byDay={byGoal.get(g.id)} onRemoved={refresh} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-label mb-3 text-xs uppercase text-muted-foreground">Focus Mode</h2>
          <BlockedSitesPanel
            mode={blockingMode}
            onSetMode={handleSetBlockingMode}
            blockedSites={sites}
            allowedSites={allowedSites}
            hasPermission={hasPermission}
            granting={granting}
            onGrantPermission={handleGrantPermission}
            onAddBlocked={handleAddSite}
            onRemoveBlocked={handleRemoveSite}
            onAddAllowed={handleAddAllowedSite}
            onRemoveAllowed={handleRemoveAllowedSite}
          />
        </section>

        <section>
          <h2 className="font-label mb-3 text-xs uppercase text-muted-foreground">Feedback</h2>
          <Card>
            <FeedbackForm />
          </Card>
        </section>
      </div>
    </div>
  );
}

function NewGoalForm({ onCreate }: { onCreate: (name: string, minutes: number) => void }) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim(), minutes);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex-1">
        <label className="font-label text-xs uppercase text-muted-foreground">Goal name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Deep Work"
          className="mt-1 w-full"
        />
      </div>
      <div>
        <label className="font-label text-xs uppercase text-muted-foreground">
          Daily goal (min)
        </label>
        <Input
          type="number"
          min={5}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="mt-1 w-24"
        />
      </div>
      <Button type="submit" disabled={submitting || !name.trim()}>
        {submitting ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}
