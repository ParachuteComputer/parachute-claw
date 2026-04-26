# Paraclaw Architecture

> Phase A → B → C. The trajectory in one document.

## The core insight

The Parachute ecosystem already has the primitive that nobody else in the agent-framework space has nailed: **scoped vault tokens that double as agent identity**.

`pvt_…` tokens carry a scope (`vault:read` / `vault:write` / `vault:admin`, with per-vault-name scopes on the roadmap as `vault:<name>:<action>`). They're created via `parachute vault tokens create --scope <s>`, hashed at rest, individually revocable. They authenticate any HTTP/MCP client.

NanoClaw — and Claw-family frameworks generally — already think correctly about agent isolation: per-agent-group containers with explicit filesystem mounts, message queues over SQLite, no IPC. What they don't have is a canonical authentication primitive: agents either hold raw API keys (a footgun) or route through bespoke credential injectors. OneCLI's Agent Vault is one such injector for NanoClaw; it works but it's specific to the framework.

**Compose Parachute Vault's scoped tokens with NanoClaw's container model, and you get the cleanest agent identity story in the ecosystem:**

- **One agent = one container = one scoped vault token.** The container's only credential is a `pvt_…` token that authorizes exactly the operations its scope allows.
- **Auth surface = Parachute OAuth.** No separate accounts. The agent is a known client of the user's vault.
- **Knowledge surface = Parachute Vault.** What the agent reads, what it writes, what it learns — all in the user's graph, queryable by every other AI the user has connected.
- **Operational surface = NanoClaw.** Containers, messaging adapters, schedules, message queues — inherited.

This is the shape Paraclaw is building toward.

## Phase A — the skill (today)

A NanoClaw skill, installed via `/add-parachute` in a NanoClaw fork.

### What the skill does

```
User runs `/add-parachute` in their NanoClaw fork
  ↓
Claude Code asks:
  - Which Parachute Vault? [http://127.0.0.1:1940/vault/default]
  - What scope? [vault:read | vault:write | vault:admin]
  - Mint a fresh token, or paste an existing one?
  ↓
If "mint":
  Skill runs: parachute vault tokens create --scope <scope> --label "claw-<agent-group>"
  Captures the pvt_… token from CLI output
  ↓
Skill writes the MCP server entry to the agent group's config:
  {
    "mcpServers": {
      "parachute-vault": {
        "url": "<vault-url>/mcp",
        "headers": { "Authorization": "Bearer pvt_…" }
      }
    }
  }
  ↓
Optionally: create a vault note "claws/<agent-group>" with the agent's
CLAUDE.md content, and configure the agent's CLAUDE.md to query that
note on startup. (Self-referential agent identity.)
  ↓
Claude Code restarts the agent group's container. Done.
```

### What the skill does NOT do

- It does not patch NanoClaw upstream. Skill installs into the user's fork as a `/add-parachute` command.
- It does not mint long-lived tokens with broad scope by default. It asks. It defaults to `vault:read`.
- It does not bypass Parachute's existing auth flow. It uses the same `parachute vault tokens create` everyone else uses.

### Networking

The skill picks the right vault URL based on where NanoClaw runs:

- **Container with `--network host`** → `http://127.0.0.1:1940/vault/<name>/mcp` works (host's loopback is reachable).
- **Container with default bridge networking** → loopback isn't reachable; the skill prompts for a tailnet or public URL (e.g. `https://<machine>.<tailnet>.ts.net/vault/<name>/mcp` from `parachute expose tailnet/public`).
- **Apple Container on macOS** → host loopback typically works via `host.docker.internal`-style addressing; the skill detects and prompts.

See `docs/phase-a-skill.md` for the full installer reference.

## Phase B — the distribution

A Parachute-flavored distribution of NanoClaw. Same upstream, same containers, same messaging, **plus**:

### B.1 — Web UI for agent management

The killer feature, and NanoClaw upstream's defensible non-feature. NanoClaw's stance is "no dashboards, talk to Claude Code." That's right for the kind of operator who lives in Claude Code. For the user who wants to spin up an "answer my Telegram politely while I'm in meetings" agent, it's the wrong shape.

**Paraclaw's UI is a Vite + React + TypeScript PWA**, served by a small Bun server. It lives at `localhost:1944` (or whatever canonical slot it claims at ship time per `parachute-cli`'s port authority — the doc here shouldn't pre-reserve).

**Pages:**

- **Agents list** — every agent group, its channels, its scopes, its last activity. Click to drill in.
- **Agent detail** — the agent's vault note (its identity), recent message traffic across all channels, scheduled jobs, container status. Edit the note → agent updates.
- **New agent wizard** — name, channels to subscribe to, scopes, optional CLAUDE.md template. One click → container spun up, scoped token minted, MCP wired.
- **Tokens & access** — list of all vault tokens issued to claws, by claw, by scope. Revoke per claw.
- **Channels** — which channels are connected, which agents listen on which. Add a channel via NanoClaw's existing skill flow but visualized.
- **Schedules** — recurring jobs, last run, next run. Edit schedules without dropping into shell.

**State / data flow:**

- The Paraclaw server reads agent state from NanoClaw's existing SQLite databases (it doesn't own them — it observes).
- It reads vault state via a `vault:read` token of its own.
- It mutates by shelling out to `parachute vault …` and `nanoclaw …` commands, treating them as authoritative.
- It does not reimplement what already works.

### B.2 — OAuth handoff

Paraclaw is an OAuth client of the user's Parachute Vault. Login flow:

```
User opens Paraclaw web UI
  ↓
Click "Connect to your vault"
  ↓
Browser → vault OAuth: /oauth/authorize (RFC 7591 DCR has already
registered Paraclaw on first launch; per-user PKCE on each session)
  ↓
User sees vault consent page: "Paraclaw wants vault:admin (scope it
needs to mint per-agent tokens) — approve?"
  ↓
Approve → Paraclaw gets an admin token (its own, not the user's)
  ↓
Paraclaw stores the token, uses it to mint per-agent scoped tokens
on demand. Per-agent tokens never touch the user.
```

The user types no `pvt_…` tokens. They click consent once at setup; everything else is invisible.

### B.3 — Vault-as-registry

Every Paraclaw-managed agent has a vault note as its source of truth:

- **Path:** `claws/<agent-group-name>` (e.g. `claws/personal-assistant`)
- **Content:** the agent's `CLAUDE.md` (its persona, its tools, its constraints)
- **Metadata (frontmatter):**
  - `claw_token_label` — which vault token this agent uses (so revocation is one-click)
  - `claw_scopes` — what the agent can do
  - `claw_channels` — which channels feed into this agent
  - `claw_schedules` — list of cron + actions
  - `claw_container_id` — the underlying NanoClaw container (read-only; managed by NanoClaw)

**The agent reads its own note as part of its memory.** Editing the note in Notes (or via `update-note` from another agent) propagates to the running agent on next message. The vault is the agent's source of truth; Paraclaw is the materialization layer.

This is the cleanest shape we've found for "what is an agent." It's a vault note. Everything else is operational.

### B.4 — Inherited from NanoClaw

We don't reimplement these. We compose:

- Per-agent-group containers with explicit mounts.
- Channel adapters (WhatsApp / Telegram / Discord / Slack / iMessage / etc.).
- SQLite-backed message queues (inbound / outbound per session).
- Scheduled jobs.
- Claude Agent SDK runtime inside the container.
- The `/add-<channel>` skill flow.

Paraclaw shows them in a UI. NanoClaw runs them.

## Phase C — the long arc

Once Phase B is real, the surface area opens up:

- **Agent-to-agent messaging** with each agent's actions written to its own vault note. The conversation between agents is a graph the user can traverse later.
- **Multi-vault agents** holding tokens for several scopes simultaneously, reasoning about which vault to read/write per request. (Requires per-vault-name scopes to land in vault — already on roadmap.)
- **Cross-agent delegation** where a planning agent can issue narrower-scoped sub-tokens to executor agents for the duration of a task. (Requires vault to support delegated/scoped sub-token issuance — a real Phase C ask of the vault.)
- **Cosmo-local sharing of agent recipes**: vault note describing an agent persona is portable. Share with another Parachute user → they instantiate that agent against their own vault, no data crosses.

These aren't shipping anytime soon. They're the trajectory that makes the foundation worth building right.

## Composition with the rest of Parachute

| Parachute module | Paraclaw uses it for |
|---|---|
| Vault | identity (scoped tokens), memory (notes), registry (claws/* path) |
| CLI | port authority for the Phase B server, `parachute install claw` registration |
| Notes | the existing UI for editing the `claws/*` notes (until / unless Paraclaw's own UI subsumes it for that subset) |
| Scribe | optional — voice-message transcription for messaging channels (delegated through vault's transcription worker) |
| Patterns | governance, canonical ports, OAuth scopes, module protocol |

Paraclaw is a consumer of every module above; nothing in Paraclaw needs to change those modules to work.

## What Paraclaw is NOT

- **Not an LLM-tool-loop reimplementation.** Claude Agent SDK does that.
- **Not a competitor to NanoClaw.** Phase A is a skill. Phase B is a distribution. The diff is intentionally small.
- **Not multi-tenant SaaS.** Single-user / single-laptop / single-tailnet is the primary target. Multi-user comes after Parachute Cloud.
- **Not a replacement for direct vault clients.** Claude Code, Notes, Codex, etc. continue to talk to vault directly. Paraclaw doesn't proxy those.

## Open questions

- **Skill format.** NanoClaw skills are CLAUDE.md-driven; we need to verify the exact shape (`/add-<name>` invocation, file layout) once we've actually run NanoClaw and inspected an existing skill. Phase A code lands once that's confirmed.
- **UI ↔ NanoClaw boundary.** Paraclaw's UI reads NanoClaw's SQLite. Stable boundary or fragile one? Spike Phase B with a read-only UI first; promote to read-write only once boundary holds.
- **Multi-vault agents.** Phase C wants this, but it requires vault-side scope work. Track in `parachute-vault` issues.
- **What does "running an agent on a server" look like?** Phase B UI presumes you're on the same machine. Remote management — Paraclaw UI on laptop, claws on a home server — is a Phase B.5 question.

## Status & sequencing

1. **Phase 0** (today): empirical install of NanoClaw + manual MCP wiring of vault. Validate the path before committing to skill code.
2. **Phase A skill** (next): based on Phase 0 findings; ship as the `/add-parachute` skill. Reach RC, turn on branch protection, npm publish (if relevant — skills may not be npm-distributed).
3. **Phase B server + UI** (after Phase A has real users): Bun server + Vite/React PWA. Claim a canonical port via `parachute-cli`. OAuth-client of vault. Vault-as-registry.
4. **Phase B.5 — remote management** (if Phase B has demand): Paraclaw UI talking to a remote Paraclaw server.
5. **Phase C** (if the foundation lights up): agent-to-agent, multi-vault, delegation, recipe sharing.

Each phase is a real release. The shape can change at every gate based on actual user feedback.
