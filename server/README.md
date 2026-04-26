# server/

Paraclaw orchestration server. Bun + thin REST over Parachute Vault.

## What it does

Bridges the Paraclaw UI to the user's vault. Reads agents (notes at `claws/*`), exposes them over `/api/agents`, lets the UI send test inbox messages, list runs, create new agents.

The server holds **one** secret: a vault admin token (or in Phase B, an OAuth-issued admin token from the user's vault). Per-agent tokens are minted and handed to the runtime — never to the UI, never logged.

## Run

```sh
cd server
bun install

# 1. Mint a vault admin token for the server.
parachute vault tokens create --scope vault:admin --label paraclaw-server
# → pvt_...

# 2. Boot the server.
export PARACLAW_VAULT_URL=http://127.0.0.1:1940/vault/default
export PARACLAW_VAULT_TOKEN=pvt_...
bun src/server.ts
# → paraclaw-server listening on http://127.0.0.1:1944

# 3. From the UI (or curl):
curl http://127.0.0.1:1944/health
curl http://127.0.0.1:1944/api/agents
```

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe. |
| GET | `/api/agents` | List all claws (notes at `claws/<name>`). |
| POST | `/api/agents` | Create a new agent (writes the identity note). Body: `{ name, systemPrompt, scopes?, channels? }`. |
| GET | `/api/agents/:name` | Detail view: identity, channels, scopes, last-run, inbox depth. |
| GET | `/api/agents/:name/runs` | Recent runs, newest first. |
| POST | `/api/agents/:name/send` | Write an inbox message (the test path). Body: `{ content, source?, from? }`. |

## Auth model

**v1 (today):** server holds a vault admin token via env var. Single-user / single-laptop posture. Anyone who can hit the server can act as the user — bind to `127.0.0.1` only and don't expose publicly.

**Phase B:** server registers as an OAuth client of vault, completes the handshake on first run, persists the resulting admin token. UI users authenticate via vault's OAuth consent page; server mints per-agent tokens on demand. Per-agent tokens never round-trip to the user's browser.

## Port

`1944` is hard-coded in the scaffold for visibility — **not yet claimed in `parachute-cli/PORT_RESERVATIONS`**. When Paraclaw hits RC, file an issue against `parachute-cli` to claim the slot via the now-shipped CLI port authority. Don't pre-reserve before code is real (per `parachute-patterns/patterns/canonical-ports.md`).

## What this isn't

- **Not a proxy** — the UI doesn't go through the server to talk to vault. The server has its own admin token; UI requests are mediated for the agent management surface only.
- **Not the vault** — the server doesn't store agent state. Vault is the source of truth.
- **Not the runtime** — the server doesn't run the agent loop. The runtime in `../runtime/` does. The server may spawn runtime processes in Phase B, but the loop logic is in `../runtime/`.
