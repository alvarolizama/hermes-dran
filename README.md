# Hermes Dran

A [Dran](https://github.com/alvarolizama/dran) second brain integration plugin for the [Hermes Agent](https://hermes-agent.nousresearch.com) desktop app. Monitor your projects, goals, plans, and todos from a status bar chip — click any item to open it in the Dev Browser.

![Hermes Dran](https://img.shields.io/badge/Hermes-Desktop%20Plugin-blue)

## What it is

Hermes Dran is a desktop plugin that adds a single status bar chip showing a live count of active items in your Dran second brain. Click the chip to open a modal with four tabs — Projects, Goals, Plans, and Todos — each with count badges. The Todos tab renders as a 5-column Kanban board. Click any item to open the Dran web page in a new Dev Browser tab.

The plugin talks directly to your Dran instance's REST API (`/api/index` and `/api/todos` endpoints) and auto-refreshes every 30 seconds.

### Features

- **🎯 Single status bar chip** — plain text "Dran" label with a colored status dot:
  - 🟢 Green = active todos exist
  - 🔵 Blue/accent = has items (projects/goals/plans) but no active todos
  - ⚪ Gray = empty
- **📊 Count badge** — total active items shown next to the chip
- **🗂️ 4-tab modal** — Projects, Goals, Plans, Todos — each with a count badge
- **📋 Kanban board** — Todos tab shows 5 columns (Backlog → This Week → Today → In Progress → Done)
- **🔗 Click-to-open** — clicking any item opens the Dran page in a new Dev Browser tab via `window.dispatchEvent('hermes:dev-browser:new-tab')`
- **🔄 Auto-refresh** — polls Dran API every 30 seconds
- **🚫 Smart filtering** — hides archived items, cancelled todos, done projects/plans, and goals at 100% progress
- **🎨 Theme-aware** — uses the app's CSS variables (`var(--ui-*)`), adapts to any theme automatically

### Requirements

- A running [Dran](https://github.com/alvarolizama/dran) instance (self-hosted)
- The [Hermes Dev Browser](https://github.com/alvarolizama/hermes-dev-browser) plugin installed (for click-to-open functionality)

## Repo Structure

```
hermes-dran/
├── desktop/
│   └── plugin.js              # Status bar chip + modal with tabs
├── README.md
└── LICENSE
```

## Installation

### Option A: Symlinks (recommended for development)

Clone the repo and symlink the `desktop/` directory into Hermes:

```bash
git clone https://github.com/alvarolizama/hermes-dran.git ~/Workspace/Repos/hermes-dran

# Desktop plugin → desktop/
ln -s ~/Workspace/Repos/hermes-dran/desktop ~/.hermes/desktop-plugins/hermes-dran
```

Edit in `~/Workspace/Repos/hermes-dran/`, git push from there, and Hermes reads changes in real-time via the symlink. No copy scripts needed.

### Option B: Manual install (for non-dev setups)

```bash
mkdir -p ~/.hermes/desktop-plugins/hermes-dran
curl -o ~/.hermes/desktop-plugins/hermes-dran/plugin.js \
  https://raw.githubusercontent.com/alvarolizama/hermes-dran/main/desktop/plugin.js
```

### Configure your Dran connection

Edit the top of `desktop/plugin.js` and set your Dran instance URL, API token, and context:

```js
var DRAN_URL = 'http://your-dran-instance:4000'
var DRAN_TOKEN = 'your-api-token-here'
var DRAN_CONTEXT = 'personal'
```

### Restart Hermes

Restart the Hermes desktop app. The "Dran" chip will appear in the status bar.

## Configuration

All configuration is at the top of `plugin.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DRAN_URL` | `http://local-apps.vpn.cloud:4000` | Base URL of your Dran instance |
| `DRAN_TOKEN` | *(set in file)* | Dran API bearer token |
| `DRAN_CONTEXT` | `personal` | Dran context slug to query |
| `REFRESH_MS` | `30000` | Auto-refresh interval in milliseconds |

## How it works

The plugin registers a single status bar item (`statusBar.right`, order 130) that renders the Dran chip. On click, it opens a `Dialog` modal with tabbed content:

1. **Projects tab** — lists active (non-done, non-archived) projects from `/api/index`
2. **Goals tab** — lists active (non-100% progress) goals from `/api/index`
3. **Plans tab** — lists active (non-done, non-archived) plans from `/api/index`
4. **Todos tab** — renders a 5-column Kanban board from `/api/todos`, grouped by `meta.kanban_status`

Clicking any item dispatches a `hermes:dev-browser:new-tab` `CustomEvent` on `window`, which the Dev Browser plugin listens for and opens the Dran page URL in a new tab.

## Plugin-to-plugin communication

The Dran plugin communicates with the Dev Browser plugin via window `CustomEvent`s:

```js
window.dispatchEvent(new CustomEvent('hermes:dev-browser:new-tab', {
  detail: { url: 'https://your-dran/todos/my-todo?context=personal' }
}))
```

No direct import or coupling — the events are loosely coupled and fail gracefully if the Dev Browser plugin isn't installed.

## License

MIT
