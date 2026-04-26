# server/

Phase B server scaffold. Bun + SQLite. Skeleton only — see [`../docs/architecture.md`](../docs/architecture.md) §Phase B and [`../docs/ui-design.md`](../docs/ui-design.md) for what this becomes.

## Status

- ✓ Skeleton boots (`bun install && bun src/server.ts` → listens on `:1944`, responds at `/health`)
- ☐ Reads NanoClaw SQLite (the bridge in `nanoclaw-bridge.ts`)
- ☐ OAuth client of vault (`oauth.ts`)
- ☐ Mints per-agent vault tokens (`vault-client.ts`)
- ☐ REST API for the UI (`routes.ts`)

## Run

```sh
cd server
bun install
bun src/server.ts
# → Paraclaw server listening on http://127.0.0.1:1944
```

`/health` is the only endpoint that responds today. Everything else is `501 Not Implemented` with a pointer to the relevant doc section.

## Port

Hard-codes `1944` in this scaffold for visibility. **Pre-RC: not yet claimed in `parachute-cli/PORT_RESERVATIONS`.** When this hits RC, file an issue against `parachute-cli` to claim the slot via the now-shipped CLI port authority (`parachute-cli#54` / `parachute-patterns/patterns/cli-as-port-authority.md`). Don't pre-reserve before code is real per `canonical-ports.md`.

## Layout

```
server/
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts            — Bun.serve entrypoint
    ├── routes.ts            — HTTP routes (skeleton: /health + 501s)
    ├── oauth.ts             — Vault OAuth client (placeholder)
    ├── vault-client.ts      — Vault HTTP client + token minting (placeholder)
    └── nanoclaw-bridge.ts   — NanoClaw SQLite reader + CLI shell-out (placeholder)
```
