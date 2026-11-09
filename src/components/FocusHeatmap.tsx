import { KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Task, openDayDetail } from "../api";
import {
  HEAT_LEVELS,
  addDays,
  currentStreak,
  dateKey,
  formatDuration,
  heatLevel,
  heatmapWeeks,
  keyToDate,
  minutesByDay,
} from "../lib/stats";
import { Card, CardContent } from "./ui/card";

const GAP = 4;
const MIN_CELL = 12;
const MAX_CELL = 28;

const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];

function shortDate(key: string): string {
  return keyToDate(key).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function longDate(key: string): string {
  return keyToDate(key).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** "387h" for the big stat; falls back to "45m" under an hour. */
function bigHours(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h` : formatDuration(minutes);
}

interface Props {
  tasks: Task[];
}

export default function FocusHeatmap({ tasks }: Props) {
  const today = dateKey(new Date().toISOString());
  const byDay = useMemo(() => minutesByDay(tasks), [tasks]);
  const sessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== "completed" || t.is_break) continue;
      const key = dateKey(t.scheduled_start);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const firstKey = useMemo(() => {
    let first = today;
    for (const key of byDay.keys()) if (key < first) first = key;
    return first;
  }, [byDay, today]);
  const { weeks, monthLabels } = useMemo(() => heatmapWeeks(firstKey, today), [firstKey, today]);

  const totalMinutes = useMemo(() => [...byDay.values()].reduce((a, b) => a + b, 0), [byDay]);
  const totalSessions = useMemo(
    () => [...sessionCounts.values()].reduce((a, b) => a + b, 0),
    [sessionCounts],
  );
  const streak = currentStreak(byDay, 1);

  // Squares shrink to fit the card width, down to MIN_CELL; past that the
  // grid scrolls sideways instead.
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const columns = weeks.length;
  const fit = Math.floor((width - (columns - 1) * GAP) / columns);
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, fit || MAX_CELL));
  const gridWidth = columns * cell + (columns - 1) * GAP;
  const scrolls = width > 0 && gridWidth > width;

  // Open on the newest weeks when the grid overflows.
  useLayoutEffect(() => {
    if (scrolls && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [scrolls, columns]);

  const [hovered, setHovered] = useState<{ key: string; x: number; y: number } | null>(null);
  const [activeKey, setActiveKey] = useState(today);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  function describe(key: string): string {
    const minutes = byDay.get(key) ?? 0;
    return minutes > 0 ? formatDuration(minutes) : "No focus";
  }

  function showTooltip(key: string, target: HTMLElement) {
    const shell = shellRef.current;
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const center = rect.left + rect.width / 2 - shellRect.left;
    setHovered({
      key,
      x: Math.min(Math.max(center, 80), shellRect.width - 80),
      y: rect.top - shellRect.top,
    });
  }

  function open(key: string) {
    openDayDetail(key, shortDate(key));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, key: string) {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = addDays(key, step);
    const target = cellRefs.current.get(next);
    if (!target) return;
    setActiveKey(next);
    target.focus();
  }

  const hasHistory = byDay.size > 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <p className="font-label text-xs uppercase text-muted-foreground">
          Your focus · {columns} {columns === 1 ? "week" : "weeks"}
        </p>

        <div ref={shellRef} className="relative">
          <div ref={scrollRef} className={scrolls ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: gridWidth }}>
              <div className="relative mb-1.5 h-4" aria-hidden="true">
                {monthLabels.map((m) => (
                  <span
                    key={`${m.column}-${m.label}`}
                    className="font-label absolute top-0 text-[10px] uppercase text-muted-foreground"
                    style={{ left: m.column * (cell + GAP) }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
              <div
                role="group"
                aria-label="Focus time per day. Use arrow keys to move between days, Enter to open one."
                className="flex"
                style={{ gap: GAP }}
                onMouseLeave={() => setHovered(null)}
              >
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((key, di) => {
                      if (!key) return <div key={di} style={{ width: cell, height: cell }} />;
                      const minutes = byDay.get(key) ?? 0;
                      const sessions = sessionCounts.get(key) ?? 0;
                      const isToday = key === today;
                      return (
                        <button
                          key={key}
                          ref={(el) => {
                            if (el) cellRefs.current.set(key, el);
                            else cellRefs.current.delete(key);
                          }}
                          tabIndex={key === activeKey ? 0 : -1}
                          aria-label={`${longDate(key)}${isToday ? " (today)" : ""}: ${
                            minutes > 0
                              ? `${formatDuration(minutes)}, ${sessions} ${sessions === 1 ? "session" : "sessions"}`
                              : "no focus"
                          }`}
                          onClick={() => open(key)}
                          onKeyDown={(e) => handleKeyDown(e, key)}
                          onFocus={(e) => {
                            setActiveKey(key);
                            showTooltip(key, e.currentTarget);
                          }}
                          onBlur={() => setHovered(null)}
                          onMouseEnter={(e) => showTooltip(key, e.currentTarget)}
                          className={`cursor-pointer rounded-[22%] outline-none transition-[box-shadow] duration-100 [transition-timing-function:var(--ease-out)] hover:ring-1 hover:ring-foreground/40 focus-visible:ring-2 focus-visible:ring-ring ${HEAT_BG[heatLevel(minutes)]} ${
                            isToday
                              ? "ring-2 ring-secondary ring-offset-1 ring-offset-card hover:ring-2 hover:ring-secondary"
                              : ""
                          }`}
                          style={{ width: cell, height: cell }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {hovered && (
            <div
              role="presentation"
              className="font-label pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background shadow-relief-md"
              style={{ left: hovered.x, top: hovered.y - 6 }}
            >
              {shortDate(hovered.key)} · {describe(hovered.key)}
              {hovered.key === today ? " · Today" : ""}
            </div>
          )}
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Legend">
          {HEAT_LEVELS.map((label, i) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[22%] ${HEAT_BG[i]}`} aria-hidden="true" />
              <span className="font-label text-[10px] uppercase text-muted-foreground">{label}</span>
            </li>
          ))}
        </ul>

        {hasHistory ? (
          <dl className="grid grid-cols-3 gap-6 border-t border-foreground/10 pt-5">
            <Stat value={bigHours(totalMinutes)} label="Focused" />
            <Stat value={String(totalSessions)} label={totalSessions === 1 ? "Session" : "Sessions"} />
            <Stat value={`${streak}d`} label="Day streak" />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your focus history will fill in here as you complete sessions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-1">
      <dt className="font-label text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="font-display text-5xl font-semibold tabular-nums tracking-[-0.03em] text-foreground">
        {value}
      </dd>
    </div>
  );
}
