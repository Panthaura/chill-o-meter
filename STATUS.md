## Known Issues / Blockers

| # | Issue | Impact | Location | Status |
|---|---|---|---|---|
| 1 | Zero commits | No version history, no branches, no PRs | Entire repo | Open |
| 2 | Scheduler first check timing | 5s first-check fires before user may have customized settings (minor) | `stress-scheduler.js:29-33` | Open |
| 3 | `dist/` in repo | Build artifacts + 7000+ files bloat repo (partially fixed by `.gitignore`) | `dist/` | Open |
| 4 | Scattered German UI strings | Hard to maintain, i18n-unfriendly | `app.js`, `interventions.js`, `notifications.js`, `index.html` | Open |
| ~~5~~ | ~~`app.on('activate')` focus expiry~~ | ~~Only checks in-memory scheduler state, not storage — won't catch expired sessions on fresh launch~~ | ~~`main.js:159-168`~~ | **Fixed** - Added `showFocusEndNotification()` call |
| ~~6~~ | ~~`intervention:get-all` IPC handler exists but not exposed in `preload.js`~~ | ~~Handler defined in `interventions.js` but `preload.js` doesn't expose it; renderer doesn't use it (interventions hardcoded)~~ | ~~`interventions.js:71`, `preload.js`~~ | **Fixed** - Exposed `getInterventionAll()` in preload.js |
| 7 | `stress:submit` returns `{ success: true }` but renderer doesn't check it | Return value is correct but unused by renderer (renderer only checks for errors via `.catch()`) | `stress-scheduler.js:89` | Open (intentional) |

## Fixed Issues (Latest Debug Cycle)

- **Issue #5**: `app.on('activate')` now calls `showFocusEndNotification()` when focus session expires while app was hidden
- **Issue #6**: `getInterventionAll()` exposed in preload.js for future use
- **Cosmetic**: Fixed indentation in `stress-scheduler.js:84` (closing brace)
- **Minor**: Fixed grounding state off-by-one in `renderer/app.js:691` (sets to `steps.length - 1` instead of `steps.length`)

## TODO

- [ ] Make initial commit of all source files
- [ ] Add more tests for dashboard stats calculations (7/30-day averages, level distribution, weekly data)
- [ ] Add tests for stress scheduler and intervention completion tracking
- [ ] Centralize German UI strings into a single lookup object
- [ ] Consider deferring scheduler first-check to first full interval instead of 5s
- [ ] Add `focus:get-status` storage sync when deactivating expired sessions
