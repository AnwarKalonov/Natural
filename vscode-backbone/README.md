# Natural VS Code Backbone

This folder runs a real VS Code workbench backbone for Natural using OpenVSCode Server (Code - OSS) plus a local Natural extension.

## What this gives you

- Real VS Code editor core (workbench, extensions API, keybindings, tabs, explorer, SCM, etc.)
- Browser-accessible IDE at `http://localhost:3000`
- Natural extension commands:
  - `Natural: Open App`
  - `Natural: Send Selection to Chat`

## 1) Start OpenVSCode Server

From project root:

```bash
cd /Users/anwarkalonov/Downloads/natural-code-editor\ \(3\)/vscode-backbone
docker compose up -d
```

Open:

- VS Code backbone: `http://localhost:3000/?folder=/workspace`

## 2) Connect Natural web app to it

Set env var in your app root `.env.local`:

```bash
VITE_VSCODE_WEB_URL=http://localhost:3000/?folder=/workspace
```

Then restart Natural dev server.

## 3) Optional extension setting

Inside OpenVSCode settings, you can change:

- `natural.appUrl` (default `http://localhost:5173`)

This controls where extension commands open Natural.

## 4) Stop

```bash
cd /Users/anwarkalonov/Downloads/natural-code-editor\ \(3\)/vscode-backbone
docker compose down
```

