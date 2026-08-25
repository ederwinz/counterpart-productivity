import { useEffect, useState, FormEvent } from "react";
import { Check } from "lucide-react";
import { FocusTask, PresetDef, createTask, listPresets, startPresetSession } from "../api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const NO_GOAL = "none";
const DURATION_PRESETS = [15, 25, 45, 60];
const TABS = [
  { key: "now", label: "Now" },
  { key: "presets", label: "Presets" },
  { key: "later", label: "Later" },
] as const;

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

interface Props {
  goals: FocusTask[];
  onCreated: () => void;
}

export default function TaskForm({ goals, onCreated }: Props) {
  const [mode, setMode] = useState<"now" | "presets" | "later">("now");

  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState<string>(NO_GOAL);

  // "Now" mode
  const [preset, setPreset] = useState<number>(25);
  const [usingCustom, setUsingCustom] = useState(false);
  const [customDuration, setCustomDuration] = useState(90);
  const [starting, setStarting] = useState(false);

  // "Presets" mode
  const [presetDefs, setPresetDefs] = useState<PresetDef[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [startingPreset, setStartingPreset] = useState(false);

  // "Later" mode
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(Date.now() + 5 * 60_000)));
  const [laterDuration, setLaterDuration] = useState(60);
  const [scheduling, setScheduling] = useState(false);

  const selectedGoalName = goals.find((g) => String(g.id) === goalId)?.name;
  const selectedPreset = presetDefs.find((p) => p.key === selectedPresetKey) ?? presetDefs[0];

  useEffect(() => {
    listPresets().then((defs) => {
      setPresetDefs(defs);
      setSelectedPresetKey((current) => current ?? defs[0]?.key ?? null);
    });
  }, []);

  async function handleStartNow(e: FormEvent) {
    e.preventDefault();
    setStarting(true);
    try {
      const duration = usingCustom ? customDuration : preset;
      const finalTitle = title.trim() || selectedGoalName || "Focus session";
      await createTask(finalTitle, new Date(), duration, goalId !== NO_GOAL ? Number(goalId) : null);
      setTitle("");
      onCreated();
    } finally {
      setStarting(false);
    }
  }

  async function handleStartPreset(e: FormEvent) {
    e.preventDefault();
    if (!selectedPreset) return;
    setStartingPreset(true);
    try {
      const finalTitle = title.trim() || selectedGoalName || selectedPreset.label;
      await startPresetSession(
        selectedPreset.key,
        finalTitle,
        goalId !== NO_GOAL ? Number(goalId) : null,
      );
      setTitle("");
      onCreated();
    } finally {
      setStartingPreset(false);
    }
  }

  async function handleSchedule(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setScheduling(true);
    try {
      await createTask(
        title.trim(),
        new Date(when),
        laterDuration,
        goalId !== NO_GOAL ? Number(goalId) : null,
      );
      setTitle("");
      onCreated();
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="inline-flex w-fit rounded-full bg-muted p-0.5"
        role="tablist"
        aria-label="Scheduling mode"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={mode === tab.key}
            onClick={() => setMode(tab.key)}
            className={cn(
              "font-label rounded-full px-3 py-1 text-xs uppercase transition-colors",
              mode === tab.key
                ? "bg-card text-foreground shadow-relief-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "now" ? (
        <form onSubmit={handleStartNow} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATION_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setPreset(mins);
                  setUsingCustom(false);
                }}
                className={cn(
                  "font-label rounded-full border px-3 py-1.5 text-xs uppercase transition-colors",
                  !usingCustom && preset === mins
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {mins}m
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUsingCustom(true)}
              className={cn(
                "font-label rounded-full border px-3 py-1.5 text-xs uppercase transition-colors",
                usingCustom
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Custom…
            </button>
            {usingCustom && (
              <div className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  autoFocus
                  className="w-12 bg-transparent text-sm text-foreground outline-none"
                />
                <span className="font-label text-xs uppercase text-muted-foreground">min</span>
              </div>
            )}
          </div>

          {goals.length > 0 && (
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger className="h-8 w-fit text-xs text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GOAL}>No goal</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Focus session"
          />

          <Button type="submit" disabled={starting} className="w-full">
            {starting ? "Starting…" : "Start Focus Session"}
          </Button>
        </form>
      ) : mode === "presets" ? (
        <form onSubmit={handleStartPreset} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {presetDefs.map((p) => {
              const selected = selectedPresetKey === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPresetKey(p.key)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border bg-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {selected && (
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      )}
                      {p.label}
                    </span>
                    <span className="font-label shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs uppercase text-muted-foreground">
                      {p.work_minutes}/{p.break_minutes}
                    </span>
                  </div>
                  <p className="text-xs leading-snug text-muted-foreground">{p.description}</p>
                </button>
              );
            })}
          </div>

          {goals.length > 0 && (
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger className="h-8 w-fit text-xs text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GOAL}>No goal</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={selectedPreset?.label ?? "Focus session"}
          />

          <Button type="submit" disabled={startingPreset || !selectedPreset} className="w-full">
            {startingPreset ? "Starting…" : `Start ${selectedPreset?.label ?? "Preset"}`}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSchedule} className="flex flex-col gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you working on?"
          />
          {goals.length > 0 && (
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GOAL}>No goal</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-3">
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="flex-1"
            />
            <div className="flex h-9 items-center gap-2 rounded-[10px] border border-border px-3">
              <input
                type="number"
                min={5}
                step={5}
                value={laterDuration}
                onChange={(e) => setLaterDuration(Number(e.target.value))}
                className="w-14 bg-transparent text-sm text-foreground outline-none"
              />
              <span className="font-label text-xs uppercase text-muted-foreground">min</span>
            </div>
          </div>
          <Button type="submit" disabled={scheduling || !title.trim()} className="w-full">
            {scheduling ? "Scheduling…" : "Schedule"}
          </Button>
        </form>
      )}
    </div>
  );
}
