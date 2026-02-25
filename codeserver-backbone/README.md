# Natural code-server Backbone

Run Natural on top of a real `code-server` (VS Code OSS) backend.

## Start

```bash
cd /Users/anwarkalonov/Downloads/natural-code-editor\ \(3\)/codeserver-backbone
docker compose up -d
```

Open:

- `http://localhost:8080/?folder=/workspace`

## Connect Natural app

Set in `/Users/anwarkalonov/Downloads/natural-code-editor (3)/.env.local`:

```bash
VITE_CODE_SERVER_URL=http://localhost:8080/?folder=/workspace
```

Restart your Vite dev server after editing env vars.

## Stop

```bash
cd /Users/anwarkalonov/Downloads/natural-code-editor\ \(3\)/codeserver-backbone
docker compose down
```
