# Hermes Dran

A [Dran](https://github.com/alvarolizama/dran) second brain integration plugin for the [Hermes Agent](https://hermes-agent.nousresearch.com) desktop app. Monitor your projects, goals, plans, and todos from a status bar chip — click any item to open it in the Dev Browser.

![Hermes Dran](https://img.shields.io/badge/Hermes-Desktop%20Plugin-blue)

## What it is

Hermes Dran is a desktop plugin that adds a single status bar chip showing a live count of active items in your Dran second brain. Click the chip to open a modal with four tabs — Projects, Goals, Plans, and Todos — each with count badges. The Todos tab renders as a 5-column Kanban board. Click any item to open the Dran web page in a new Dev Browser tab.

The plugin talks directly to your Dran instance's REST API (`/api/index` and `/api/todos` endpoints) and auto-refreshes every 30 seconds.

### Features

- **🎯 Single status bar chip** — three segments with live counts:
  - **Todos** 🟢 N — active todos (excludes done, cancelled, archived)
  - **Plans** 🟢 N — active plans (excludes done, archived)
  - **Goals** 🟢 N — all goals (excludes archived)
- **🗂️ 4-tab modal** — Todos, Plans, Goals, Projects — each with a count badge (excludes archived only)
- **📋 Kanban board** — Todos tab shows 5 columns (Backlog → This Week → Today → In Progress → Done), flexible width
- **⚙️ Inline controls** — change status (projects/plans), health (goals), and progress (goals) directly from the list
- **📦 Archive button** — archive any item directly from the list
- **🔗 Click-to-open** — clicking any item opens the Dran page in a new Dev Browser tab
- **🔄 Auto-refresh** — polls Dran API every 30 seconds
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

## Quickstart (for agents)

> Run these steps as-is. Everything is relative to the clone location (`$REPO`) and `~/.hermes/` — no machine-specific paths.

```bash
# 1. Clone
git clone https://github.com/alvarolizama/hermes-dran.git
cd hermes-dran && export REPO="$PWD"

# 2. Desktop plugin (chip + modal UI)
ln -sfn "$REPO/desktop" ~/.hermes/desktop-plugins/hermes-dran
```

**Dependencies:** a running [Dran](https://github.com/alvarolizama/dran) instance. After installing, configure the connection (URL + API token + context) — see [Configure your Dran connection](#configure-your-dran-connection) below. Restart the Hermes desktop app (or `/reset`) after installing.

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

1. **Todos tab** — renders a 5-column Kanban board from `/api/todos`, grouped by `meta.kanban_status`. Excludes archived and cancelled.
2. **Plans tab** — lists all non-archived plans from `/api/pages?type=plan`. Inline status dropdown (draft/active/done) + archive button.
3. **Goals tab** — lists all non-archived goals from `/api/pages?type=goal`. Inline progress slider + health indicator + archive button.
4. **Projects tab** — lists all non-archived projects from `/api/pages?type=project`. Inline status dropdown (draft/active/on_hold/done) + archive button.

**Chip counts**: Todos excludes done/cancelled/archived. Plans excludes done/archived. Goals excludes archived only.

**Tab counts**: All tabs show non-archived items only (done items are visible in the list).

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
