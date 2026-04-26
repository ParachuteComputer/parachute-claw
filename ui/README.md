# ui/

Paraclaw web UI. Vite + React 19 + TypeScript.

## Status

- ✓ Builds clean (`bun run build`)
- ✓ Three real screens — agent list, agent detail, new-agent wizard
- ✓ Talks to the server (`../server/`) for all data
- ✓ Test message form on agent detail (writes to inbox; runtime processes)
- ☐ OAuth flow (today: server has the admin token)
- ☐ Token rotation, channel management, schedule editing (Phase B continues)
- ☐ Mobile polish + PWA manifest

## Run

```sh
cd ui
bun install
bun run dev
# → Vite dev server at http://localhost:5173/claw/
```

For the UI to do anything interesting, the server has to be running too:

```sh
cd ../server
export PARACLAW_VAULT_URL=http://127.0.0.1:1940/vault/default
export PARACLAW_VAULT_TOKEN=pvt_...   # vault:admin scope
bun src/server.ts
```

The Vite dev server proxies `/api/*` to the Paraclaw server at `localhost:1944`.

## Build

```sh
bun run build
# → dist/, served by Paraclaw server (or any static host) at /claw/
```

## Mount path

`/claw/` matches `parachute-notes` — Vite base + BrowserRouter basename + future PWA scope all aligned. When Phase B ships, Paraclaw lives at `https://<host>/claw/` under the ecosystem hub.
