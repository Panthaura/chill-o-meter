# CONTEXT.md

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         main.js                                     │
│                  (Electron Main Process)                            │
│                                                                     │
│  createWindow() ──→ loads renderer/index.html                       │
│  preload.js ──→ exposes window.electronAPI via contextBridge        │
│  initTray() + createTray()                                          │
│  new StressScheduler() + start()                                    │
│  setupIpc(…) for every module                                       │
│  ipcMain.handle() for app-level (show/hide/clear-history/timers)    │
└──────────────┬──────────────────────────────┬───────────────────────┘
                │ IPC (send/receive)          │ IPC (send/receive)
┌──────────────▼──────────────────┐  ┌───────▼──────────────────────┐
│  modules/  (main process)       │  │  renderer/ (process)         │
│  ┌──────────────────────────┐   │  │  ┌────────────────────────┐  │
│  │ stress-scheduler.js      │   │  │  │ app.js                 │  │
│  │   StressScheduler class  │───┼──┼─→│  showView(),           │  │
│  │   setupIpc()             │   │  │  │  startExercise(),      │  │
│  └──────────────────────────┘   │  │  │  loadDashboard(),      │  │
│  ┌──────────────────────────┐   │  │  │  startBoxBreathing(),  │  │
│  │ interventions.js         │   │  │  │  startSighExercise(),  │  │
│  │   interventions object   │───┼──┼─→│  startGrounding(),     │  │
│  │   setupIpc()             │   │  │  │  …                     │  │
│  └──────────────────────────┘   │  │  └────────────────────────┘  │
│  ┌──────────────────────────┐   │  ┌──────────────────────────────┐  │
│  │ dashboard.js             │   │  │  modules/ (renderer process) │  │
│  │   calculateStats()       │───┼──┼─→│  audio.js                  │  │
│  │   setupIpc()             │   │  │  │  AudioEngine               │  │
│  └──────────────────────────┘   │  │  │  playGong(), playTick(), … │  │
│  ┌──────────────────────────┐   │  │  └────────────────────────────┘  │
│  │ storage.js               │   │  │  └────────────────────────────┘  │
│  │   loadData(), saveData() │───┼───┼─→│                                │  │
│  │   get(key), set(key,val) │   │  │                                │  │
│  │   merge(), deepMerge()   │   │  │                                │  │
│  └──────────────────────────┘   │  │                                │  │
└──────────────┬───────────────────┘  └──────────────────────────────┘
                │
┌──────────────▼──────────────────┐
│  main/  (main process)          │
│  ┌──────────────────────────┐   │
│  │ tray.js                  │   │
│  │   init(), createTray()   │   │
│  │   Sends: stress-check,   │   │
│  │          focus-end,      │   │
│  │          show-view       │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ notifications.js         │   │
│  │   showStressNotification │   │
│  │   showFocusNotification  │   │
│  │   showFocusEndNotification│  │
│  │   showInterventionNotif. │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
                │
        ~/.chill-o-meter/data.json
               (JSON file)
```

## Data Flow

1. **User interacts** with renderer UI (`app.js` DOM).
2. `app.js` calls `window.electronAPI.<method>()` (bridged via `preload.js` `contextBridge`).
3. IPC message routes to the relevant `modules/` handler in the main process.
4. The handler reads/writes `storage.js`, which persists to `~/.chill-o-meter/data.json`.
5. Results flow back through IPC to the renderer.
6. `app.js` updates the DOM accordingly.

## Event Flow (Notifications)

1. `StressScheduler` emits `'check'` every configured interval (default 180 min).
2. `main.js` listener checks focus mode state. If inactive:
   - Calls `showStressNotification()` (main/notifications.js).
   - Calls `showWindow()` to bring the window forward.
   - Tray sends `stress-check` IPC event to renderer.
3. Renderer plays `playReminder()` and navigates to `#view-stress`.

## Views

| View | Element ID | Purpose | Trigger |
|---|---|---|---|
| Stress Check | `view-stress` | 1-10 stress scale slider | Default view, after exercise, after focus |
| Focus Mode | `view-focus` | Duration picker + countdown timer | Manual start, or auto after high-stress submission |
| Interventions | `view-interventions` | Exercise cards (4 types) | Auto when stress > 5, manual nav |
| Exercise | `view-exercise` | Animated exercise phase | Click on intervention card |
| Dashboard | `view-dashboard` | Stats, charts, level distribution | Manual nav, tray menu |
| Settings | `view-settings` | Interval + sound toggle | Manual nav, tray menu |
| Box Timers | `view-box-timers` | Custom phase duration inputs | Manual nav from interventions |

## Key Modules

| Module | Location | Lines | Purpose |
|---|---|---|---|
| **storage.js** | `modules/storage.js` | 126 | JSON file persistence with dot-notation key access, deep merge, and in-memory cache |
| **stress-scheduler.js** | `modules/stress-scheduler.js` | 181 | `EventEmitter` subclass. Manages periodic stress-check `setInterval`, focus mode state (`_focusStatus`), and IPC handlers for stress/focus/settings |
| **interventions.js** | `modules/interventions.js` | 76 | Defines 4 exercises with German names, descriptions, and step/duration arrays. IPC handlers for completion and history |
| **dashboard.js** | `modules/dashboard.js` | 102 | `calculateStats()` computes 7/30-day aggregates, weekly breakdown, stress level distribution |
| **tray.js** | `main/tray.js` | 107 | System tray icon with context menu. Sends IPC events (`stress-check`, `focus-end`, `show-view`) to renderer on menu clicks |
| **notifications.js** | `main/notifications.js` | 44 | Native OS notifications via Electron `Notification` API (4 notification types) |
| **audio.js** | `modules/audio.js` | 119 | Web Audio API engine exposed as `window.audioEngine`. Generates gong, tick, reminder, and success tones via oscillators |
| **preload.js** | `preload.js` | 63 | `contextBridge.exposeInMainWorld('electronAPI', ...)` -- 20 methods across 7 categories plus 3 IPC listeners |
| **app.js** | `renderer/app.js` | 890 | Renderer SPA: view navigation, stress slider, focus timer, 4 exercise animations, dashboard, settings, box timer customization, data export |
| **test.js** | `tests/test.js` | 173 | Test suite for `storage.js` and `dashboard.js` using Node.js `assert` module |

## IPC Channel Reference

| Channel | Direction | Handler File | Purpose |
|---|---|---|---|
| `stress:submit` | renderer → main | `stress-scheduler.js` | Save stress value, update achievements |
| `stress:get-history` | renderer → main | `stress-scheduler.js` | Return stress history array |
| `stress:force-check` | renderer → main | `stress-scheduler.js` | Manually trigger scheduler check |
| `stress-check` | main → renderer | `tray.js` (send) | Scheduler check event from tray |
| `settings:get` | renderer → main | `stress-scheduler.js` | Return settings object |
| `settings:update` | renderer → main | `stress-scheduler.js` | Deep merge settings, restart scheduler |
| `focus:start` | renderer → main | `stress-scheduler.js` | Start focus session, save to storage |
| `focus:end` | renderer → main | `stress-scheduler.js` | End focus session |
| `focus:get-status` | renderer → main | `stress-scheduler.js` | Return focus state, auto-expiry check, totalMs for progress |
| `focus-end` | main → renderer | `tray.js` (send) | Focus session ended event |
| `intervention:complete` | renderer → main | `interventions.js` | Record completion, update achievements |
| `intervention:get-history` | renderer → main | `interventions.js` | Return intervention history |
| `intervention:get-by-type` | renderer → main | `interventions.js` | Return single intervention definition |
| `intervention:get-all` | renderer → main | `interventions.js` | Return all intervention definitions |
| `dashboard:get-stats` | renderer → main | `dashboard.js` | Return calculated statistics |
| `achievements:get` | renderer → main | `dashboard.js` | Return achievements object |
| `show-view` | main → renderer | `tray.js` (send) | Navigate to a specific view |
| `box-timers:get` | renderer → main | `main.js` | Get custom box breathing durations |
| `box-timers:save` | renderer → main | `main.js` | Save custom box breathing durations |
| `app:show` | renderer → main | `main.js` | Show main window |
| `app:hide` | renderer → main | `main.js` | Hide main window |
| `app:toggle` | renderer → main | `main.js` | Toggle window visibility |
| `history:clear` | renderer → main | `main.js` | Clear all history and reset achievements |
| `data:export-json` | renderer → main | `main.js` | Export all data as JSON file via save dialog |
| `data:export-csv` | renderer → main | `main.js` | Export stress/intervention/focus history as CSV file via save dialog |

## Primary Entry Points

| Entry Point | File | What It Does |
|---|---|---|
| App bootstrap | `main.js` → `app.whenReady()` | Creates window (700x750), tray, `StressScheduler`, registers all IPC handlers |
| Renderer boot | `renderer/app.js` (IIFE at bottom) | Loads box timer settings, auto-resumes focus mode if active, sets up DOM event listeners |
| IPC surface | `preload.js` | `contextBridge.exposeInMainWorld('electronAPI', ...)` -- 20 methods + 3 IPC listeners |
| Data persistence | `modules/storage.js` | `~/.chill-o-meter/data.json` -- dot-notation keys, in-memory cache, deep merge |

## Key Functions

| Function | Location | Role |
|---|---|---|
| `createWindow()` | `main.js:17` | Creates BrowserWindow (700x750px) with security-hardened webPreferences |
| `createTray()` | `main/tray.js:16` | Creates system tray icon with 6-item context menu |
| `class StressScheduler` | `modules/stress-scheduler.js:6` | Extends EventEmitter, manages periodic stress-check timer and focus mode state |
| `setupIpc(scheduler)` | `modules/stress-scheduler.js:53` | Registers stress/focus/settings IPC handlers (7 handlers) |
| `calculateStats()` | `modules/dashboard.js:4` | Computes all dashboard statistics: 7/30-day averages, level distribution, weekly data |
| `loadData()` / `saveData()` | `modules/storage.js:26` | Read/write `~/.chill-o-meter/data.json` |
| `get(key)` / `set(key, value)` | `modules/storage.js:44` | Dot-notation key access, deep merge for objects, in-memory cache |
| `showView(viewName)` | `renderer/app.js:5` | SPA view navigation with CSS transitions, cleanup for exercise/focus state |
| `startExercise(type)` | `renderer/app.js:370` | Launches exercise with its animation loop (box, sigh, grounding, or PME) |
| `startBoxBreathing()` | `renderer/app.js:506` | Box breathing phase countdown with ring animation, returns `{stop()}` controller |
| `loadDashboard()` | `renderer/app.js:728` | Fetches stats via IPC, renders weekly bar chart and level distribution bars |
| `class AudioEngine` | `modules/audio.js:1` | Web Audio API sounds, exposed as `window.audioEngine` |

## Data Model

Stored in `~/.chill-o-meter/data.json` via `storage.js`. All timestamps are numeric epoch milliseconds (from `Date.now()`), not ISO strings.

```json
{
  "stressHistory": [
    { "value": 7, "timestamp": 1705329000000 }
  ],
  "interventionHistory": [
    { "type": "box-breathing", "timestamp": 1705329300000, "duration": 5 }
  ],
  "focusSessions": [
    { "duration": 60, "startTime": 1705312800000, "endTime": 1705316400000, "actualEnd": 1705316100000, "actualDuration": 55 }
  ],
  "settings": {
    "intervalMinutes": 180,
    "soundEnabled": true
  },
  "achievements": {
    "totalChecks": 42,
    "totalInterventions": 15,
    "totalFocusMinutes": 360,
    "consecutiveDays": 3,
    "lastActiveDate": "2024-01-15"
  }
}
```

## CSS Architecture

`renderer/styles/main.css` (1162 lines) uses CSS custom properties:

| Variable | Value | Purpose |
|---|---|---|
| `--bg-primary` | `#0f0f1a` | Base background |
| `--bg-secondary` | `#1a1a2e` | Secondary background |
| `--bg-card` | `rgba(255,255,255,0.05)` | Card background with transparency |
| `--accent` | `#6c63ff` | Primary accent color |
| `--focus-color` | `#00d4aa` | Focus mode indicator |
| `--danger` / `--high-color` | `#ff6b6b` | High stress / errors |
| `--warning` / `--medium-color` | `#ffa94d` | Medium stress / warnings |
| `--success` / `--low-color` | `#51cf66` | Low stress / success |

**Key features:** Glass-morphism (`backdrop-filter: blur(20px)`), animated gradient background, view transitions (`view-in` animation), responsive breakpoint at 500px.

## Module Connection Map

```
main.js
  │
  ├── app.whenReady()
  │     ├── createWindow() ──→ loads renderer/index.html
  │     │                        ├── audio.js  (window.audioEngine)
   │     │                        └── app.js    (SPA logic)
  │     │
  │     ├── initTray() + createTray()
  │     │     └── Sends IPC events to renderer:
  │     │          stress-check, focus-end, show-view
  │     │
  │     ├── new StressScheduler() + start()
  │     │     └── Emits 'check' events → showStressNotification() + showWindow()
  │     │
  │     ├── setupStressIpc(stressScheduler)
  │     │     └── stress:submit, stress:get-history, stress:force-check
  │     │         settings:get, settings:update
  │     │         focus:start, focus:end, focus:get-status
  │     │
  │     ├── setupInterventionIpc()
  │     │     └── intervention:complete, intervention:get-history
  │     │         intervention:get-by-type, intervention:get-all
  │     │
  │     ├── setupDashboardIpc()
  │     │     └── dashboard:get-stats, achievements:get
  │     │
  │     └── ipcMain.handle() for app:show, app:hide, app:toggle
  │           history:clear, box-timers:get, box-timers:save
  │
  └── modules/storage.js (shared by all modules)
        └── ~/.chill-o-meter/data.json
```
