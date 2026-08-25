# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Frontend (run from repo root):
- `npm run dev` — Vite dev server only (port 1420, fixed/strict — required by Tauri)
- `npm run build` — typecheck (`tsc`) then production build to `dist/`
- `npx tsc --noEmit` — typecheck only

Full app (Tauri, from repo root):
- `npm run tauri dev` — builds and launches the actual desktop app (Rust + webview); use this to see real behavior, not just the frontend
- `npm run tauri build` — production app bundle

Rust backend (from `src-tauri/`, needs `export PATH="$HOME/.cargo/bin:$PATH"` if `cargo` isn't already on PATH):
- `cargo build` — compile check
- `cargo run` — same as `npm run tauri dev` but skips the Vite dev server wiring

There is no lint or test tooling configured in this project (no ESLint/Prettier/Jest/Vitest, no Rust tests). Rely on `tsc` and `cargo build` for correctness checks.

**Gotcha**: `tauri-plugin-single-instance` means only one instance of the app can run at a time. If a previously-built/installed copy (e.g. `/Applications/Focus.app`) is already running, a new `tauri dev` process will just forward to it and exit immediately. Check `ps aux | grep focus` and kill any existing instance before starting a fresh dev session.

**Gotcha**: the tray icon (`lib.rs`, `TrayIconBuilder`) must use `tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))`, **not** `app.default_window_icon()` — the latter resolves to the full 512×512 app icon and renders as a completely blank (but still clickable) status item on macOS. `Image::from_bytes` requires the `image-png` feature on the `tauri` dependency in `Cargo.toml` (already enabled) or it fails to compile. Also avoid `.icon_as_template(true)` with the current icon asset — it silently renders blank too; the icon is shown in full color instead.

## Frontend design workflow

Before doing **any** frontend design work in this repo — new UI, restyling existing UI, adding/changing components, picking colors/fonts/spacing, or reviewing UI/UX quality — invoke the `ui-ux-pro-max` skill first (`~/.claude/skills/ui-ux-pro-max`). Pull its relevant `--domain` guidance (`ux`, `style`, `color`, `typography`, `chart` as applicable) before writing code, not after. Where the work also touches token architecture or brand consistency, pull in `design-system` and/or `ui-styling` (`~/.claude/skills/`) as well. This applies even to small changes (a single button, a single input) — not just full redesigns.

Exception: `ui-ux-pro-max`'s `--design-system` generator is tuned for picking a look from scratch and will fight against this app's established "Marginalia" aesthetic (see Design system below) — don't run it blind. Use its `--domain` searches (accessibility/UX checklists, chart guidance, etc.) and judgment to extend the existing system, not its generator to replace it.

**Non-negotiable close-out step**: after building any new component (not just editing an existing one), actually call the `Skill` tool for `ui-ux-pro-max` in that turn — referencing it from memory/a prior session's summary does not count, the guidance must be pulled fresh. Then, before reporting the feature done, screenshot the new component **rendered in the real app** (not just read the JSX) and check it against the guide's Quick Reference — spacing/`justify-between` actually has room to work (parent has `w-full`, not shrink-to-fit), state is never conveyed by color alone (add an icon/text, not just a border/tint change), and elements that read as a "badge" or "pill" get real badge styling (rounded pill background), not two `<span>`s sitting next to each other in a flex row. Catching a layout bug by eye in a screenshot, after the fact, is a failure of this step — the goal is to catch it before it's ever screenshotted.

## Verification workflow

Every feature, fix, or debug in this repo must be verified directly before being reported as done — never leave verification to the user. Minimum bar for "done":

1. **Static checks first, always**: `npx tsc --noEmit` for any frontend change, `cargo build` (from `src-tauri/`) for any Rust change. Non-negotiable, even for small edits.
2. **Clean process state before launching**: `ps aux | grep -i "target/debug/focus"` and kill any stale instance (see single-instance gotcha above) before `npm run tauri dev`. After launching in the background, re-check `ps aux` a few seconds later to confirm the process is still alive — if it silently exited, it forwarded to a stale instance and you're not actually testing your changes.
3. **Prove it with a screenshot or a query, not code review alone**:
   - UI changes: raise the relevant window (`osascript ... perform action "AXRaise" of window "Focus"` / `"Focus — Dashboard"`) and `screencapture -x` it. Actually look at the image.
   - Tray/menu-bar changes: `System Events`'s accessibility tree will confirm a status item exists and is clickable even when its icon is rendering completely blank (this exact bug shipped once — see the tray icon gotcha above). Don't trust "the click worked" as proof the icon is visible; crop-screenshot the tray region itself (`screencapture -x -R<x>,<y>,<w>,<h>` — region coordinates are in **points**, not native pixels, unlike a full-screen capture).
   - Backend/data changes: inspect real state directly — `sqlite3 "$(find ~/Library/Application\ Support -iname focus.sqlite)" "SELECT ..."` for DB changes, `cat /etc/hosts` for blocking changes — rather than assuming the code path ran correctly.
4. **WKWebView automation**: `click button "..."`/`click button "..." of window ...` by name almost always fails (`-1728`) for content inside either webview — System Events can't resolve most in-page elements by accessible name, even though the elements themselves aren't fully invisible to it. **Radix-based components are a partial exception**: they expose real ARIA roles (e.g. the Select trigger shows up as a `combo box`), so those specific elements are sometimes clickable by name where plain `<button>`/`<input>` aren't.
   - **What reliably works instead: coordinate-based clicks.** `click at {x, y}` on the `process "focus"` (not a specific window) does land inside the webview. Get the target window's position/size fresh (`tell window "Focus" to return {position, size}`), measure the element's location from a just-taken screenshot, then convert screenshot-pixel → point coordinates: `points = (screenshot_px * (native_width / displayed_width)) / 2` (screenshots are native/Retina pixels at 2x; `click at` takes points). **Recompute immediately before every click** — the popover/dashboard window position is not stable across app restarts or even across screenshots taken minutes apart, and a stale position silently sends the click into the menu bar or wrong element instead of erroring.
   - If a coordinate click can't be worked out or the interaction still isn't reachable, say so plainly in the report and verify by another concrete means (direct DB/file inspection) rather than silently skipping it.
5. **Report what you actually saw**, not what you expect to see — include the concrete evidence (screenshot description, query result, log line) in the summary, not just "verified working."

## Architecture

This is a Tauri v2 (Rust) + React/TypeScript **macOS menu-bar** productivity app (product name "Focus", identifier `com.edwinzhu.focus`). It is not a typical web app — it's a background tray app with two possible webview windows.

**Core loop**: user schedules a task with a start time and duration → a Rust-side scheduler ticks every second, auto-flips the task to `active` when its time arrives (no manual start), fires an OS notification, and updates the tray icon title with a live countdown → auto-completes the task when its duration elapses. A task can also be started instantly ("Now" mode, `scheduled_start = now`) or as part of an auto-cycling study-technique preset (Pomodoro, 52/17, etc. — see `presets.rs` below), which chains work↔break sessions back-to-back with no user action between rounds.

### Two windows, one React app

`src/App.tsx` is the single entry point for both webviews. It checks `getCurrentWindow().label` to decide what to render:
- `"main"` — the small 420×600 tray popover. Shows `views/Schedule.tsx` (create/list tasks) or `views/ActiveSession.tsx` ("Focus Mode" countdown) depending on whether a task is currently active.
- `"dashboard"` — a full-size (960×680) window created on demand via the Rust `open_dashboard` command (from the tray menu or a button in the popover). Renders `views/Dashboard.tsx`: an inline always-visible task-scheduling section, recurring goals with daily progress/streaks, and blocked-site management. Not defined statically in `tauri.conf.json` — it's built at runtime with `WebviewWindowBuilder` in `commands.rs`.

Both windows must be listed in `src-tauri/capabilities/default.json` for their Tauri permissions to apply.

**Task creation is reachable from both windows independently** — `components/TaskForm.tsx` is the single shared form, mounted directly in `Schedule.tsx` and again in `Dashboard.tsx`'s "Schedule" section. It has three tabs — **Now** (instant start, duration chips), **Presets** (auto-cycling study techniques from `presets.rs` via `listPresets()`/`startPresetSession()`), **Later** (title/goal/datetime/duration, unchanged original form) — all sharing one goal-select + optional-title pattern. Since `"main"` and `"dashboard"` are separate React trees with independent state, creating a task in one window doesn't update the other's `tasks` state for free — `commands.rs::create_task` and `start_preset_session` both emit a `task-created` Tauri event specifically so both windows' `refresh()` effects (alongside the existing `task-started`/`task-completed` listeners) pick up tasks created from *either* window. If you add another task-mutating command reachable from both windows, it needs the same emit-and-listen treatment or the two windows will silently drift out of sync.

### Rust backend (`src-tauri/src/`)

- `db.rs` — SQLite (rusqlite) schema and row-mapping. Three tables: `tasks` (scheduled sessions, optionally tagged with `focus_task_id`; also carries `is_break` and the `cycle_*` columns used for auto-chaining preset sessions — see `presets.rs`), `focus_tasks` (recurring goals with a `daily_goal_minutes` target), `blocked_sites` (domains to block during a focus session). DB file lives in the app's data dir (`focus.sqlite`); `init()` creates tables and does simple `ALTER TABLE ... ADD COLUMN` migrations guarded with `.ok()` (ignore-if-exists) rather than a migration framework. Exposes `active_work_task_count()`, the single helper every blocking decision should query — it deliberately excludes `is_break = 1` rows so a break in progress never reads as "blocking should be on."
- `presets.rs` — static catalog of auto-cycling study techniques (Pomodoro 25/5, 52/17, 90-Minute Focus Block, 50/10, two Quick Sprint variants), each with work/break minutes, an optional long-break-every-N-rounds rule, and the rationale text shown in the UI. Single source of truth consumed by both `commands::list_presets` (drives the frontend's Presets tab) and `commands::start_preset_session` (looks up a preset by key to seed the first cycle task) — add new techniques here only, never hardcode numbers on the frontend.
- `commands.rs` — all `#[tauri::command]` handlers invoked from the frontend via `invoke()`. Registered in `lib.rs`'s `invoke_handler!`.
- `scheduler.rs` — the async loop (`tauri::async_runtime::spawn`, 1s tick) that transitions `pending` → `active` → `completed` tasks, sends notifications, emits `task-started`/`task-completed` events the frontend listens for, updates the tray title, and triggers site blocking/unblocking. `chain_next()` runs on every task completion: if the task carries `cycle_preset` metadata, it inserts the next task in the cycle (break after work, next work round — with `cycle_round` incremented — after a break) as a fresh `pending` row with `scheduled_start = now`, so it flows through the exact same due/active/notify pipeline on the next tick rather than duplicating that logic. Chaining stops naturally the moment a task is stopped manually (`update_task_status` → `skipped`), since that path never sets `cycle_preset` on a next row. Also exposes `reconcile()`, called once from `lib.rs`'s `setup()` before the tick loop spawns: it compares `active_work_task_count()` against `/etc/hosts` and syncs the block to match. Needed because blocking is otherwise only changed *reactively* by a status-transition event inside a running process — if the app is killed while a task is active (crash, force-quit, dev rebuild) and the DB later drifts to "no active task" some other way, nothing else ever tells `/etc/hosts` to catch up, so a stale block can persist indefinitely across restarts.
- `hosts.rs` — site-blocking mechanism. Blocks sites by editing `/etc/hosts` directly (redirecting domains to `127.0.0.1` inside `# focus-app-block-start`/`# focus-app-block-end` markers), not a network filter or browser extension. Editing `/etc/hosts` requires the file be user-writable; `grant_permission()` does a one-time `osascript ... with administrator privileges` to `chown` it to the current user, after which no further prompts are needed for the life of the machine. Blocking is applied when `active_work_task_count()` is nonzero and cleared when it's zero (see call sites in `scheduler.rs` — both the tick loop and `reconcile()` — and `commands.rs::update_task_status`/`add_blocked_site`/`remove_blocked_site`) — a task going `active` with `is_break = 1` must never trigger a block, since a break is the point where sites should be reachable again.
- `lib.rs` — app setup: DB init, notification permission request, tray icon/menu (`Schedule a task…`, `Open Dashboard`, `Quit`), window-close-hides-instead-of-quits behavior, scheduler spawn, command registration.

### Frontend (`src/`)

- `api.ts` — typed wrappers around every `invoke()` call; the single source of truth for the Task/FocusTask/BlockedSite/PresetDef shapes shared with Rust (keep in sync with `db.rs`/`presets.rs` structs when changing either side).
- `lib/stats.ts` — pure functions for turning the flat `tasks` list into per-goal daily minutes, today's progress, 7-day trend, and streaks. All dashboard progress math is computed client-side from completed sessions rather than via dedicated SQL aggregation commands. Break rows are excluded automatically since the backend always sets `focus_task_id = null` on them, and stats already only counts completed tasks with a non-null `focus_task_id` — no break-awareness needed here.
- `views/` — page-level components (`Schedule`, `ActiveSession`, `Dashboard`). `ActiveSession.tsx` renders both work and break sessions (`task.is_break` swaps the "Focus Mode"/"Break" label; `task.cycle_round` shows a "Round N" line when the active task is part of a preset cycle) — same countdown UI for both, not a separate break screen. `components/` — smaller reusable pieces (`GoalCard`, `BlockedSitesPanel`, `TaskForm` — shared task-creation form used by both `Schedule.tsx` and `Dashboard.tsx`, see below); `components/ui/` — local `Button`/`Card`/`Input`/`Select` primitives (`cva`-based variants; `Select` wraps `@radix-ui/react-select` for accessible listbox behavior, everything else is dependency-free — no shadcn CLI, no `@base-ui/react`). Never reach for a bare native `<select>` — it renders unstyled OS chrome that clashes with the rest of the app; always go through `components/ui/select.tsx`.
- `lib/utils.ts` — `cn()` class-merging helper (`clsx` + `tailwind-merge`), used by `components/ui/*`.
- `hooks/use-reduced-motion.ts` — `prefers-reduced-motion` hook via `useSyncExternalStore`; use it before adding any new transition/animation.
- Icons come from `lucide-react` — never use emoji as a structural/UI icon (an existing anti-pattern that was deliberately removed from the streak badge).

### Design system (`src/index.css`)

A three-layer token system ("Marginalia" aesthetic, ported from a separate reference project): primitive palette (`--color-paper-*`/`--color-ink-*`/`--color-moss-*`/`--color-bronze-*`/`--color-teal-*`) → semantic tokens (`--background`, `--primary`, `--card`, `--border`, etc., consumed via Tailwind v4's `@theme inline`) → component tokens (`--radius-panel: 10px` flattened across the whole radius scale, `--shadow-relief-sm/md`). Fonts are self-hosted via `@fontsource` (Schibsted Grotesk for `font-display`/`font-heading`, Work Sans for `font-body`, Fragment Mono for `font-label`) rather than a Google Fonts CDN import, so the popover renders instantly with no network dependency.

Two permanent, non-toggleable surfaces coexist rather than a light/dark mode switch: the everyday "paper" register (`Schedule.tsx`, `Dashboard.tsx`) and a dark "stage" register (`--surface-stage*` tokens) scoped specifically to `ActiveSession.tsx`'s Focus Mode countdown. Cards use `ring-1 ring-foreground/10` instead of box-shadows; buttons use a 1px `active:translate-y-px` press effect instead of a shadow change — keep new components consistent with this shape language rather than reaching for default Tailwind `shadow-sm`.

**Chrome vs. CTA typography convention**: bordered/transparent "chrome" controls — `Button`'s `outline`/`ghost` variants and the `Select` trigger — render their label uppercase in `font-label` (Fragment Mono), matching the app's section headers (`GOALS`, `FOCUS MODE`, etc.) for one consistent "editorial label" voice. Filled action buttons (`default`/`secondary`/`destructive`) stay sentence-case `font-body` on purpose — uppercase mono on a filled moss-green CTA reads as shouty at button scale. Keep this split when adding new buttons/controls rather than applying uppercase everywhere.

### Data model notes

- A `Task` is a one-off scheduled focus session; a `FocusTask` is a recurring goal (e.g. "Deep Work", 120 min/day) that sessions can optionally be tagged against via `focus_task_id`. Dashboard progress/streaks are computed only from `Task`s with `status: "completed"` and a non-null `focus_task_id`.
- A `Task` can also be one link in an auto-cycling preset chain (`cycle_preset` non-null): `is_break` distinguishes work rows from break rows, `cycle_round` is the 1-indexed work-round counter, `cycle_base_title`/`cycle_focus_task_id` are carried forward on every chained row so the goal tag and title survive across breaks (break rows themselves always get `focus_task_id = null` so break time never counts toward a goal). See `scheduler.rs::chain_next`.
- Backend is fully local (SQLite) by design — no accounts, no network sync yet. A future phase is planned to add Supabase for accounts/cross-device sync using a local-first pattern (SQLite stays source of truth); avoid introducing local-only identifiers that couldn't map cleanly to a future Postgres row.
