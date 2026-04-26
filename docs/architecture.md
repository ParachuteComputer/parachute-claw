# Paraclaw Architecture

> Parachute-native agents on Claude Agent SDK + Parachute Vault. No fork of NanoClaw, no skill on top of it. Vault is the substrate.

## The thesis

Every agent framework reinvents three things: identity, memory, and a management surface.

Parachute already has all three:

- **Identity:** scoped vault tokens (`pvt_…`) carry capability (`vault:read` / `vault:write` / `vault:admin`), are individually revocable, and are issued by the user's own vault.
- **Memory:** vault notes form a graph that the user is *already* using to think. Anything an agent reads or writes lives in that graph.
- **Management surface:** the vault's HTTP API + a thin web UI. Plus, optionally, the existing Notes PWA — every agent's identity is a note, so editing the agent in Notes works for free.

Paraclaw is what falls out when you compose those primitives with **[Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)** for the LLM-tool-loop. It is small, opinionated, and Parachute-native. It is not a fork of NanoClaw, not a skill on top of NanoClaw, not anything that requires you to install another framework first.

## The shape

```
    Channels (MCP servers)
    ┌─ Telegram-MCP ─────────────┐    Vault notes the user can read
    ├─ Discord-MCP   ────────────┤    in Notes / Claude Code / anywhere
    ├─ Email-MCP     ────────────┤
    └─ (any MCP that bridges     │             ↑ ↓
       external → vault notes)   │
            │                    │    ┌──────────────────────────┐
            ↓                    │    │  Parachute Vault          │
    claws/<name>/inbox/...  ─────┼───→│   - claws/<name>          │
                                 │    │   - claws/<name>/inbox/   │
                                 │    │   - claws/<name>/outbox/  │
                                 │    │   - claws/<name>/runs/    │
            ↑                    │    │  + scoped pvt_… tokens    │
            │                    │    │  + OAuth + 9 MCP tools    │
    claws/<name>/outbox/... ─────┘    └──────────────────────────┘
                                              ↑ ↓
                                       MCP (HTTP transport)
                                              ↑ ↓
                              ┌──────────────────────────────┐
                              │  Paraclaw Runtime (Bun)      │
                              │   - reads claws/<name>       │
                              │   - polls inbox              │
                              │   - calls Claude Agent SDK   │
                              │   - writes runs + outbox     │
                              └──────────────────────────────┘
                                              ↑ ↓
                                              │
                              ┌──────────────────────────────┐
                              │  Paraclaw Server (Bun)       │
                              │   - /api/agents              │
                              │   - /api/agents/:n/send      │
                              │   - /api/agents/:n/runs      │
                              │   - OAuth client of vault    │
                              └──────────────────────────────┘
                                              ↑ ↓
                                              │
                              ┌──────────────────────────────┐
                              │  Paraclaw UI (Vite/React)    │
                              │   - agents list              │
                              │   - agent detail             │
                              │   - new-agent wizard         │
                              │   - tokens / channels / cron │
                              └──────────────────────────────┘
```

## What lives where

### Vault (the substrate)

Every agent has a tree of notes:

| Path | Content |
|---|---|
| `claws/<name>` | The agent's `CLAUDE.md` as note content. Frontmatter has scopes, channels list, schedules, container settings (when we add them), token label. |
| `claws/<name>/inbox/<ts>-<source>` | Incoming message from a channel. `<source>` is which channel (`telegram`, `discord`, `cli`, etc.). The body is the message; frontmatter has the originating identity (sender, channel-specific message id). |
| `claws/<name>/outbox/<ts>-<source>` | Outgoing message the runtime wants delivered. Same shape as inbox. Channels read from here and deliver. |
| `claws/<name>/runs/<run-id>` | Full record of one agent invocation: which inbox message triggered it, what tools were called, what was written to outbox, errors if any. |

The vault owns this tree. The runtime, the server, channels, and the user all touch the tree but none of them store anything outside it. Uninstall Paraclaw → your agents' history stays in your vault as a graph you can query forever.

### Channels (MCP servers, not Paraclaw code)

A "channel" is anything that bridges an external messaging service into vault inbox notes (and reads outbox notes back out). The simplest channel is **the user typing into the UI** — the UI's "send a test message" form writes to `claws/<name>/inbox/<ts>-cli`, the runtime processes, the user sees the response in `claws/<name>/runs/<id>`.

Real channels are MCP servers. We don't write them. We compose:

- [Telegram-MCP](https://github.com/sparfenyuk/mcp-telegram) (community) — bridges Telegram to MCP tools
- Discord-MCP — same shape
- (Existing or yet-to-be-written MCPs for whatever external system you want)

The channel adapter's job in Paraclaw's universe: write to `claws/<name>/inbox/...` when a message arrives, and watch `claws/<name>/outbox/...` for messages to deliver. We provide a small library + recipe for this; community MCPs that don't follow the convention can be wrapped by a tiny bridge that does.

This is **way less work** than NanoClaw's "we ship 14 channel adapters." Each channel becomes a small composition over an existing MCP. We never own a Telegram client.

### Runtime (the agent loop)

A Bun program. Started with `paraclaw run <agent-name>` (or via the server when the user clicks "Activate"). Steady-state loop:

```
1. Read claws/<agent-name> from vault → get system prompt + config.
2. Poll claws/<agent-name>/inbox/ for unprocessed notes.
3. For each new inbox note:
   a. Construct a Claude Agent SDK `query()` with:
      - system prompt: the claws/<name> note content
      - user prompt: the inbox message
      - mcpServers: vault MCP (always) + any per-agent additional MCPs
        from frontmatter
   b. Stream messages from the agent loop.
   c. When the agent emits a "send" intent, write to outbox.
   d. When the agent finishes, write a runs/<id> note with full transcript.
   e. Mark the inbox note as processed (move to inbox/processed/, or
      delete; pick one — see open questions).
4. Sleep, repeat.
```

The runtime is small. ~300 lines of TypeScript at most. Everything interesting (agent reasoning, tool calls, channel I/O) happens elsewhere.

### Server (the orchestration layer)

A Bun + `Bun.serve` HTTP server. Stateless except for the OAuth session it holds with vault. Endpoints:

- `GET /api/agents` — list claws (`vault.list_notes(path_prefix='claws/')`)
- `GET /api/agents/:name` — read the agent's identity note + recent runs
- `POST /api/agents` — new-agent wizard (creates `claws/<name>` note, mints scoped token, optionally starts runtime)
- `POST /api/agents/:name/send` — write a `cli`-source inbox note (test path)
- `GET /api/agents/:name/runs` — list `claws/<name>/runs/*`
- `GET /api/agents/:name/runs/:id` — read a single run
- `POST /api/oauth/start` / `GET /api/oauth/callback` — OAuth handshake against vault
- `POST /api/agents/:name/start` / `POST /api/agents/:name/stop` — runtime lifecycle (later: spawns/manages a runtime process; v1: just a flag on the note)

Authenticated via the OAuth-issued vault token (the user's session). Per-agent tokens are minted on demand and handed to the runtime; never to the user, never logged.

### UI (the management surface)

A Vite + React + TypeScript PWA mounted at `/claw/` under the ecosystem hub. Three pages today (per `docs/ui-design.md`):

- **Agents list** — every claw with status + last-active.
- **Agent detail** — identity (vault note, editable), access (token / scope / channels / schedules), recent activity (runs).
- **New agent wizard** — five-step modal that ends with a working agent in <60 seconds.

The UI talks to the server. The server talks to vault. Vault is the source of truth. The UI is allowed to be opinionated about presentation (cron pickers, scope explainers, channel toggles) but never owns state.

## Phase trajectory

### Phase A (today, post-pivot)

- Runtime + server + UI scaffolding all real. Each boots, each does its part for the simplest case (one agent, no real channels, CLI-source inbox via the UI's send form).
- Read-side complete: list agents, view agent, view runs.
- Write-side complete: send a test message, see the agent process it, see the response.
- OAuth flow stubbed: the v1 server can run with a hand-pasted vault admin token until we wire the OAuth handshake properly.

### Phase B (next)

- OAuth flow real: paraclaw server registers as an OAuth client of vault, completes browser handshake, persists the admin token.
- New-agent wizard real: writes the `claws/<name>` note, mints a scoped token with `parachute vault tokens create`, persists frontmatter, optionally starts a runtime.
- One real channel adapter: Telegram (highest signal-to-noise for solo users). Adapter writes to inbox; runtime processes; outbox messages get delivered back through Telegram.
- Schedules: cron entries stored in `claws/<name>` frontmatter; runtime cron-aware.

### Phase C (the long arc)

- Multi-vault agents (token-per-vault per agent group; depends on per-vault-name scopes shipping in vault).
- Cross-agent delegation (planning agent issues sub-tokens; depends on vault gaining sub-token issuance).
- Recipe sharing: `claws/<name>` notes are portable; share with another Parachute user → they instantiate against their own vault.

## What this is NOT

- **Not a NanoClaw fork.** We respect NanoClaw's existence and learn from it; we do not depend on it.
- **Not a NanoClaw skill.** The previous repo state had `skill/add-parachute.md` for that approach. Removed in this pivot.
- **Not a multi-tenant SaaS.** Single-user, single-vault is the v1 target. Multi-user is Parachute Cloud.
- **Not a container framework.** v1 has no containers. Scoped tokens are the boundary. If we hit real isolation needs (running untrusted recipes, exposing agents to public chat), we revisit. Even then, containers are an implementation detail of the runtime, not the architecture.

## Why this beats forking NanoClaw

NanoClaw's architectural choices (SQLite-per-session message queues, OneCLI Agent Vault for credentials, "no dashboards, talk to Claude Code") are coherent for *its* worldview. Each of them duplicates something Parachute already has done better. A fork inherits those choices and either lives with the duplication or fights upstream forever.

By starting from Parachute primitives (vault, scoped tokens, MCP) and Claude Agent SDK directly, we get to express the design we actually want. The maintenance surface is small (we don't own a Telegram client; we don't own a SQLite schema for queues; we don't own a credential vault). The integration with the rest of Parachute is native, not bolted on.

The cost: we don't get NanoClaw's existing channel adapters for free. The mitigation: there are existing MCP servers for most channels, and "wrap an MCP into a vault inbox bridge" is much smaller scope than "implement a Telegram client from scratch."

## Open questions

- **Inbox lifecycle:** what happens to processed inbox notes? Move to `inbox/processed/`? Delete? Tag with frontmatter? Probably move-then-tag for auditability; verify with first real users.
- **Runtime process model:** v1 runs the runtime as a single Bun process per agent invocation (called from server when there's work to do, exits when inbox empty). v1.5 runs it as a long-lived daemon that watches inbox via vault triggers. Pick based on what feels right when we run the first agent end-to-end.
- **MCP server lifecycle for channel adapters:** when does Telegram-MCP start? Per-agent, or shared? Shared makes sense for resource use; per-agent makes sense for isolation. Defer until we have one channel actually shipping.
- **Tool scoping:** even within `vault:write` scope, an agent might be asked to "only ever write notes tagged #work." We can implement that as a runtime layer (filter tool calls before passing to vault) but it's another design surface. Track for Phase B/C.
