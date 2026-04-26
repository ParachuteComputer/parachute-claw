# Paraclaw UI — design sketch

> Phase B's killer feature. NanoClaw upstream's stance is "no dashboards, talk to Claude Code"; that's right for power users, wrong for the "I just want my Telegram-answering agent" path. This doc captures what the UI should be before we start writing code.

## Audience

- **Primary:** a Parachute user with an installed vault who wants to spin up agents that do work for them, on the channels they live in (Telegram / Discord / iMessage / etc.). They're comfortable in the browser; they don't want to drop into a shell to manage their agents.
- **Secondary:** a Claude-Code-fluent power user who *also* benefits from a dashboard for at-a-glance state, even if their primary edit path stays in Claude Code.

## Three-screen MVP

The smallest UI that earns its existence is three screens:

### Screen 1 — Agents list (the home screen)

```
┌─ Paraclaw ──────────────────────────── [+ New agent] ─┐
│                                                       │
│  ☑ personal-assistant                                 │
│      ↳ vault:write · Telegram, iMessage              │
│      ↳ Last active: 8 minutes ago                     │
│                                                       │
│  ☑ research-bot                                       │
│      ↳ vault:read · Discord                           │
│      ↳ Last active: yesterday                         │
│                                                       │
│  ⏸ work-summarizer (paused)                          │
│      ↳ vault:write · Slack                            │
│      ↳ Scheduled: every weekday at 17:30              │
│                                                       │
│  ─── Tokens & access ──────────────── 3 active ──    │
│  ─── Channels ─────────────────────── 4 connected ── │
│  ─── Schedules ────────────────────── 7 jobs ────────│
└───────────────────────────────────────────────────────┘
```

Each row shows: name, scope, channels, last-active, paused indicator. Click → screen 2.

The bottom rail summarizes adjacent state (tokens / channels / schedules) — drill-into views when explicit work is needed.

### Screen 2 — Agent detail

```
┌─ personal-assistant ───────── [Edit] [Pause] [Delete] ┐
│                                                       │
│  Identity (vault note: claws/personal-assistant)      │
│  ─────────────────────────────────────────────────    │
│  > You are my personal assistant. Use Telegram and    │
│  > iMessage to answer messages on my behalf when I'm  │
│  > in meetings. Always check vault first for context. │
│  > [Edit in Notes] [Edit here]                        │
│                                                       │
│  Access                                               │
│  ─────────────────────────────────────────────────    │
│  Vault:        http://127.0.0.1:1940/vault/default    │
│  Scope:        vault:write                             │
│  Token label:  claw-personal-assistant                │
│                              [Rotate token] [Revoke]  │
│                                                       │
│  Channels                                             │
│  ─────────────────────────────────────────────────    │
│  ✓ Telegram   (chat: @aaron, last: 8m ago)            │
│  ✓ iMessage   (group: Family, last: 2h ago)           │
│                                            [+ Add]    │
│                                                       │
│  Schedules                                            │
│  ─────────────────────────────────────────────────    │
│  Daily morning brief — 7:30 AM weekdays               │
│      "summarize last 24h of vault notes tagged work"  │
│                              [Edit] [Run now]         │
│                                            [+ Add]    │
│                                                       │
│  Recent activity                                      │
│  ─────────────────────────────────────────────────    │
│  8m ago · Telegram · @sarah                            │
│    "what's the status of the Berlin trip?"            │
│    → queried 4 notes, sent reply                      │
│                                                       │
│  18m ago · iMessage · Family group                    │
│    [voice memo, 0:34]                                 │
│    → transcribed via scribe, captured to vault as    │
│      a note tagged #family                            │
│                                                       │
│  ────────────────────── 23 more · [View all] ─────    │
└───────────────────────────────────────────────────────┘
```

The agent detail page is the heart. Identity is the vault note, editable in two places (here, or in Notes — both round-trip). Access shows the token; rotation/revocation is a click. Channels and schedules are managed inline. Recent activity is a stream of "what happened, what the agent did about it, what changed in the vault."

### Screen 3 — New agent wizard

A 5-step modal:

1. **Name.** What do you call this agent? (`personal-assistant`, `research-bot`, etc.) Validates against existing names.
2. **Persona.** A textarea for the agent's CLAUDE.md content. Optional starter templates ("answer messages politely while you're in meetings", "summarize vault content on a schedule", "research-and-report into a project tag").
3. **Scope.** Pick `vault:read` / `vault:write` / `vault:admin`. Plain-language descriptions of each. Default `vault:read`.
4. **Channels.** Multi-select from already-connected channels. Add a new channel inline (drops into NanoClaw's existing `/add-<channel>` flow).
5. **Schedules** (optional). Add cron + action templates. Skippable; can be added later.

Submit → Paraclaw mints the token, writes the `claws/<name>` vault note, hands off to NanoClaw to spin up the container and wire the channels. Loading state → done state with link to the new agent's detail page.

## Architecture

### Component layout

```
ui/                             — Vite + React + TypeScript PWA
├── package.json
├── vite.config.ts              — base path /claw/, similar to notes
├── index.html
└── src/
    ├── app/
    │   ├── App.tsx
    │   ├── routes.tsx          — agent list / detail / new / tokens / channels / schedules
    │   ├── auth/               — OAuth client to vault
    │   └── shared/             — layout, nav, common components
    ├── lib/
    │   ├── vault/              — vault HTTP client (reads claws/* notes, mints tokens)
    │   └── nanoclaw/           — bridge to local nanoclaw state via paraclaw server
    └── components/
        ├── AgentList.tsx
        ├── AgentDetail.tsx
        ├── NewAgentWizard.tsx
        └── …

server/                         — Bun + SQLite paraclaw service
├── package.json
├── src/
│   ├── server.ts               — Bun.serve, listens on canonical-port-claimed-at-ship
│   ├── routes.ts               — REST + OAuth endpoints
│   ├── nanoclaw-bridge.ts      — reads NanoClaw SQLite, shells out to nanoclaw CLI
│   ├── vault-client.ts         — vault HTTP / token minting
│   └── oauth.ts                — Paraclaw is an OAuth client of vault
└── README.md
```

### Data ownership

- **Vault owns**: agent identity (vault notes at `claws/<name>`), tokens, scopes, schedules' data half (the *what*).
- **NanoClaw owns**: containers, message queues, channel adapters, schedule cron-tab, runtime state.
- **Paraclaw owns**: nothing exclusive. It's a UI + thin coordinator. It reads from vault and NanoClaw; it mutates by calling `parachute vault …` and `nanoclaw …` commands.

This is deliberately chosen. The UI's failure should never corrupt vault state or NanoClaw state. Paraclaw can be uninstalled and your agents keep running.

### OAuth flow

```
User opens http://localhost:1944/claw/  (or wherever Paraclaw lives)
   ↓
First-run check: do we have a vault OAuth session?
   ↓
No:
   → POST to vault's /oauth/register (RFC 7591 DCR) — register Paraclaw as a client.
     Cache the client_id locally.
   → Redirect browser to vault's /oauth/authorize?client_id=…&scope=vault:admin&...
   → User completes consent (password + 2FA if enabled).
   → vault redirects back to /claw/oauth/callback with code.
   → Paraclaw POSTs /oauth/token with code → receives bearer token.
   → Stores token in localStorage (PWA) + paraclaw server's SQLite.
   ↓
Yes (or once Yes):
   → All vault calls use the bearer token.
   → Paraclaw mints per-agent tokens via vault's /api/tokens endpoint
     (or whatever the API equivalent of `parachute vault tokens create` is —
      worth verifying that an HTTP path exists; if not, paraclaw shells out
      to the CLI as a fallback).
```

Paraclaw asks for `vault:admin` because token-minting is an admin operation. The user gives consent once; Paraclaw never sees per-agent tokens (it mints them and hands them straight to NanoClaw).

### Identity flow at agent creation

```
User clicks "Spin up new agent" → fills wizard → submits.
   ↓
Paraclaw server:
   1. Generate a fresh `pvt_…` token via vault API at requested scope.
   2. Create the `claws/<agent-name>` vault note with the user's CLAUDE.md
      content + frontmatter (token_label, scopes, channels list, schedules).
   3. Construct the NanoClaw config: MCP entry pointing at vault, channel
      subscriptions, schedule entries.
   4. Invoke `nanoclaw create-agent <name> --config <generated>`.
   5. Wait for container to come up.
   6. Stream logs to UI until "agent ready" event.
   7. Redirect to agent detail.
```

The vault note is the source of truth. NanoClaw is the materialization. Paraclaw is the conductor.

## Why a PWA, why Vite + React

Matches `parachute-notes`. Same toolchain, same bun-link development pattern, same install story. Once Phase B is real, the user has two PWAs (Notes + Paraclaw) at canonical paths under their hub origin. They can install both to home screen on mobile.

## What we DON'T build

- **Embedded chat with the agent.** The agent's chat surface is the messaging channel (Telegram etc.). Paraclaw is for management, not conversation. (We could add a "send a test message to this agent" affordance from the detail page; that's it.)
- **Visual flow editor for agent personas.** The persona is a CLAUDE.md textarea. Don't replace markdown with a no-code builder.
- **Agent marketplace.** Recipe sharing is Phase C. MVP: just your agents.
- **Multi-tenant management.** One Paraclaw = one user's agents. Multi-user is Parachute Cloud.

## Open questions

- **NanoClaw bridge stability.** Reading NanoClaw's SQLite + shelling out to its CLI — how stable is that interface? If volatile, we'll need to spec a contract with upstream or fork the relevant pieces.
- **Token-minting API path.** Vault has the CLI command but I haven't verified an HTTP `/api/tokens` endpoint with admin-token auth. If it doesn't exist, we file an issue against vault to add one (or shell out from the server, which is uglier).
- **Mobile UX.** The PWA is desktop-first MVP. Mobile is "view your agents and pause/resume." Full editing is desktop. Same shape as Notes today.
- **Realtime.** "Recent activity" stream — polling is fine for v1. Server-Sent Events for v2 once we have load.

## Sequencing inside Phase B

1. **Server skeleton** — Bun, listens on canonical port (claim from CLI). Hard-codes a single test agent. No UI yet.
2. **OAuth flow** — Paraclaw registers as DCR client of vault, completes flow, stores token. Validates with a `/api/whoami` request.
3. **Read-only UI v1** — agents list + detail. Read state from NanoClaw + vault, no mutation. Validates the bridge.
4. **Wizard** — new-agent flow, mutation path. Mint token, write vault note, spin up container. Validates the full integration.
5. **Schedule editing, token rotation, channel management** — agent-detail completeness.
6. **Mobile polish + offline-aware fetches** — match Notes' shape.

Each step is its own PR per governance. Each step ends with something demonstrable.
