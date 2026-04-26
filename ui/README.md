# ui/

Phase B UI scaffold. Vite + React + TypeScript PWA. Skeleton only — see [`../docs/ui-design.md`](../docs/ui-design.md) for the full design.

## Status

- ✓ Skeleton boots (`bun install && bun run dev` → Vite dev server)
- ✓ Three placeholder routes (`/`, `/agents/:name`, `/agents/new`) renderable
- ☐ OAuth flow (vault as auth provider)
- ☐ Real agent list (read from server's `/api/agents`)
- ☐ Real agent detail
- ☐ New-agent wizard
- ☐ Tokens / channels / schedules screens
- ☐ Mobile polish + PWA manifest

## Run

```sh
cd ui
bun install
bun run dev
# → Vite dev server on http://localhost:5173
```

The UI calls the server (see `../server/`) at `http://localhost:1944` by default. Override with `VITE_PARACLAW_SERVER_URL`. With both running, you'll see placeholder views with `501 — see docs/...` info panels because the server isn't implemented yet.

## Layout

```
ui/
├── package.json
├── tsconfig.json
├── vite.config.ts          — base /claw/, similar to parachute-notes
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx             — Router + layout
    ├── routes/
    │   ├── AgentList.tsx       — placeholder
    │   ├── AgentDetail.tsx     — placeholder
    │   └── NewAgent.tsx        — placeholder
    └── lib/
        └── server.ts       — HTTP client to ../server/ (skeleton)
```

## Mount path

`/claw/` matches the `parachute-notes` mount-path convention (Vite base + BrowserRouter basename + service-worker scope all aligned). When Phase B ships, Paraclaw is served at `https://<your-host>/claw/` under the ecosystem hub.
