# Parachute Claw

> Parachute-native agents with vault-scoped identity.

**Today:** a [NanoClaw](https://github.com/qwibitai/nanoclaw) skill that wires a [Parachute Vault](https://github.com/ParachuteComputer/parachute-vault) into your containerized agents over MCP, with a scoped token per agent.

**Tomorrow:** a Parachute distribution of NanoClaw — same container model, same channel adapters, same Claude Agent SDK runtime — plus a web UI for spinning up and managing agents, OAuth-issued vault tokens, and the agent-as-vault-citizen experience that makes "give this agent read-only access to my work vault" a one-click affair.

## Status

**Pre-RC, exploratory.** Branch protection is off until first RC. Direct push to `main` is fine while shape is fluid; this README will get updated when we hit the governance gate.

## What problem this solves

[Parachute Vault](https://github.com/ParachuteComputer/parachute-vault) gives you scoped tokens (`vault:read` / `vault:write` / `vault:admin`) and a graph-shaped knowledge layer that any MCP client can consume. [NanoClaw](https://github.com/qwibitai/nanoclaw) gives you a containerized, multi-channel agent runtime that runs on the Claude Agent SDK. Compose them and you get:

- **One agent = one container = one scoped vault token.** A "research" agent gets `vault:read` and physically can't write. A "personal-assistant" agent gets `vault:write` and captures notes for you across Telegram / WhatsApp / Discord. A "sysadmin" agent gets `vault:admin` for the few jobs that need it.
- **No raw API keys in agent contexts.** Auth is scoped; revocation is per-token; `parachute vault tokens revoke` is the kill switch.
- **The vault is the agent's memory.** Notes the agent writes are notes you read (and vice versa). Every agent's work shows up in your knowledge graph automatically.

## Phase A — install today (skill)

Requires a working [NanoClaw](https://github.com/qwibitai/nanoclaw) and a running [Parachute Vault](https://github.com/ParachuteComputer/parachute-vault).

```sh
# Inside your NanoClaw fork, with Claude Code:
/add-parachute
```

The skill prompts for:
- Vault URL (default `http://127.0.0.1:1940/vault/default`)
- Scope (`vault:read` / `vault:write` / `vault:admin`)
- Whether to mint a fresh scoped token via `parachute vault tokens create`, or paste an existing one

It then writes the MCP server entry into your agent group's config and, optionally, syncs the agent's `CLAUDE.md` into a vault note so the agent can read its own configuration as part of its memory.

See [`docs/phase-a-skill.md`](./docs/phase-a-skill.md) for the full installer reference and the manual setup path if you'd rather wire it by hand.

## Phase B — coming next (the distribution)

A Parachute-flavored distribution of NanoClaw with:

- **Web UI for agent management.** List your agents. See which channels each is on. Spin up a new agent in one click. Issue / revoke vault tokens. Watch recent message traffic. Reschedule scheduled jobs. NanoClaw upstream's stance is "no dashboards, talk to Claude Code"; that's a defensible philosophy for power users but not for the "I just want my work agent" path.
- **OAuth handoff.** Log into Paraclaw via your Parachute Vault's OAuth flow. Paraclaw issues per-agent vault tokens automatically. No paste-token workflow.
- **Vault-as-registry.** Every agent has a vault note that *is* its identity — its name, its scopes, its channels, its `CLAUDE.md`. Edit the note, the agent updates. The agent sees its own note as part of its context.
- **Inherits NanoClaw's core.** Containers per agent group, channel adapters, scheduled jobs, message-queue I/O via SQLite — all stays.

See [`docs/architecture.md`](./docs/architecture.md) for the full Phase A → B → C trajectory and [`docs/phase-b-vision.md`](./docs/phase-b-vision.md) for the Phase B design space.

## Phase C — the long arc

The Parachute ecosystem already has the primitive nobody else has: **scoped vault tokens that are agent identity**. Phase C is what becomes possible when that primitive is everywhere:

- Agent-to-agent messaging where each agent's actions are recorded in its own vault note, so the conversation between agents *is* a graph the user can traverse later.
- Multi-vault agents that hold tokens for several scopes simultaneously and reason about which vault to read/write per request.
- Cross-agent delegation: a planning agent that can issue narrower-scoped sub-tokens to executor agents for the duration of a task.

These aren't shipping anytime soon. They're the reason the foundation is worth building well.

## Non-goals (today)

- We are not forking NanoClaw's core. We're a skill that composes with it cleanly. If NanoClaw upstream evolves, our skill follows.
- We are not building a multi-tenant SaaS. Single-user / single-laptop / single-tailnet is the primary target. Multi-user comes after Parachute Cloud lands.
- We are not implementing our own LLM-tool-loop. NanoClaw delegates to Claude Agent SDK; we inherit that and add Parachute identity on top.

## License

[AGPL-3.0](./LICENSE), matching the rest of the Parachute ecosystem.

## Cross-references

- [`parachute-vault`](https://github.com/ParachuteComputer/parachute-vault) — the knowledge graph that gives Paraclaw its identity primitives.
- [`parachute-cli`](https://github.com/ParachuteComputer/parachute-cli) — the coordinator that mints scoped tokens (`parachute vault tokens create --scope vault:read`).
- [`parachute-patterns`](https://github.com/ParachuteComputer/parachute-patterns) — cross-cutting conventions; Paraclaw conforms to module-protocol, oauth-scopes, canonical-ports, governance.
- [NanoClaw](https://github.com/qwibitai/nanoclaw) — upstream framework Phase A composes with.
