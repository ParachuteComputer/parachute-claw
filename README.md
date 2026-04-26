# Parachute Claw

> Parachute-native agents with vault-scoped identity. Claude Agent SDK + Parachute Vault. No fork of anything.

A claw is an agent. Each claw is a vault note tree at `claws/<name>` — its identity, its inbox, its outbox, its run history. Each claw runs on Claude Agent SDK with a scoped vault token (`vault:read` / `vault:write` / `vault:admin`) as its only credential. Each claw can be edited, queried, paused, or revoked from the Paraclaw web UI — or from any vault client (Claude Code, Notes, your own MCP scripts).

Paraclaw is what falls out when you stop reinventing identity, memory, and management for agents — because [Parachute Vault](https://github.com/ParachuteComputer/parachute-vault) already has all three.

## Status

**Pre-RC, exploratory.** Three real components — `runtime/`, `server/`, `ui/` — all build and typecheck. End-to-end smoke against a real vault works (create agent → see it in UI → send a message → runtime processes it via Claude Agent SDK → response appears as a vault note).

What's missing for first usable release:

- OAuth handshake from server to vault (today: server holds an admin token via env var)
- A real channel adapter (today: messages come from the UI's "send a test message" form; Telegram-MCP integration is the next piece)
- Schedule support (cron entries on `claws/<name>` frontmatter; runtime cron-aware)
- PWA polish + mobile UX

## Three things to know

1. **Vault is the substrate.** Every agent's identity, memory, message queue, and run history is in your vault. Uninstall Paraclaw → your agents' state stays in your vault as a graph you can query forever.
2. **Tokens are the boundary.** A `vault:read` claw physically can't write. A `vault:admin` claw is fully trusted. Revoke via `parachute vault tokens revoke <label>`. There's no other auth layer.
3. **Claude Agent SDK does the LLM-tool-loop.** We don't reimplement the agent loop. We compose `[query()](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)` with the vault MCP and let the SDK do its work.

## Quick start

Pre-reqs: Bun ≥ 1.3, a running [Parachute Vault](https://github.com/ParachuteComputer/parachute-vault) on `127.0.0.1:1940`, the [`parachute` CLI](https://github.com/ParachuteComputer/parachute-cli) on PATH.

```sh
# 1. Mint a vault admin token for the Paraclaw server.
parachute vault tokens create --scope vault:admin --label paraclaw-server
# → t_... (save this)

# 2. Boot the server.
cd server
bun install
PARACLAW_VAULT_TOKEN=t_... bun src/server.ts &
# → paraclaw-server listening on http://127.0.0.1:1944

# 3. Boot the UI dev server.
cd ../ui
bun install
bun run dev
# → http://localhost:5173/claw/

# 4. Open the UI, create your first claw via the wizard.
# 5. Boot a runtime for it (in a third terminal).
cd ../runtime
bun install
PARACLAW_VAULT_TOKEN=t_... bun src/cli.ts run <claw-name>
# → runtime listens on the inbox; processes whatever lands

# 6. From the agent's detail page in the UI, send a test message.
# Watch the runtime log; the response appears in vault as
# claws/<claw-name>/runs/<run-id> and (if the agent produced one)
# claws/<claw-name>/outbox/<ts>-ui.
```

## Architecture

`docs/architecture.md` is the canonical reference. The short version:

```
  Channels (MCP servers — composed, not built)
                │
                ↓
     vault notes at claws/<name>/inbox/
                │
                ↓
        Paraclaw Runtime
   (reads identity, polls inbox,
    runs Claude Agent SDK with
    vault MCP wired, writes
    outbox + runs)
                │
                ↓
     vault notes at claws/<name>/outbox/  →  Channels deliver
                              ↑
                              │
              Paraclaw Server  ──→  Paraclaw UI
              (REST over vault,    (Vite/React PWA)
               mints tokens)
```

The runtime, server, and UI are all small. The interesting things (LLM reasoning, tool execution, vault storage, OAuth) happen elsewhere; we orchestrate.

## Why not a NanoClaw fork?

[NanoClaw](https://github.com/qwibitai/nanoclaw) is a coherent framework for its worldview ("no dashboards, talk to Claude Code; OneCLI Agent Vault for credentials; SQLite-per-session message queues"). Each of those choices duplicates something Parachute already does better:

- We have OAuth-issued scoped tokens, not OneCLI Agent Vault.
- We have a graph-shaped memory layer (vault notes), not per-session SQLite queues.
- We have a web UI as a first-class management surface, not "talk to Claude Code."

A fork inherits NanoClaw's choices and either lives with the duplication or fights upstream forever. Building Paraclaw directly on Claude Agent SDK + vault expresses the design we actually want, with a smaller maintenance surface.

The cost: NanoClaw's existing channel adapters don't come for free. The mitigation: most channels already have MCP servers (Telegram, Discord, Email, etc.). "Wrap an MCP server into a vault inbox bridge" is much smaller scope than "implement a Telegram client from scratch."

See `docs/architecture.md` for the full reasoning.

## Phase trajectory

- **Phase A (today):** runtime + server + UI all real. CLI-source inbox via the UI's send form. Read agents, view runs, create new claws via wizard.
- **Phase B (next):** OAuth handshake (server registers as vault OAuth client; user approves once); first real channel adapter (Telegram-MCP); schedules (cron entries in `claws/<name>` frontmatter; runtime cron-aware); per-agent scoped token minted on creation (today the server uses its own admin token).
- **Phase C (long arc):** multi-vault claws (depends on per-vault-name scopes shipping in vault); cross-claw delegation (planning agent issues sub-tokens to executor claws); recipe sharing (claws notes are portable; share with another Parachute user → instantiate against their vault).

## Layout

```
parachute-claw/
├── README.md                  ← you are here
├── CLAUDE.md                  ← per-repo conventions
├── docs/
│   ├── architecture.md        ← canonical design doc
│   ├── phase-b-vision.md      ← deep design space exploration
│   └── ui-design.md           ← three-screen UI layout
├── runtime/                   ← the agent loop (Bun + Claude Agent SDK)
├── server/                    ← REST orchestration over vault (Bun)
└── ui/                        ← management UI (Vite/React/TS)
```

## License

[AGPL-3.0](./LICENSE), matching the rest of the Parachute ecosystem.
