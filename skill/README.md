# skill/

The Phase A NanoClaw skill. Installed into a NanoClaw fork at `.claude/skills/add-parachute.md`; invoked via `/add-parachute` in Claude Code.

## What's here

- **`add-parachute.md`** — the skill itself. A Claude-Code-driven procedure that wires a Parachute Vault into an agent group as an MCP server with a scoped token.

## Install

```sh
# Inside your NanoClaw fork:
mkdir -p .claude/skills
curl -sL https://raw.githubusercontent.com/ParachuteComputer/parachute-claw/main/skill/add-parachute.md \
  > .claude/skills/add-parachute.md
```

Then, in Claude Code:

```
/add-parachute
```

## Pre-requisites

- A working [NanoClaw](https://github.com/qwibitai/nanoclaw) install with at least one agent group.
- A running [Parachute Vault](https://github.com/ParachuteComputer/parachute-vault) on `127.0.0.1:1940` (or somewhere reachable from your NanoClaw container — see networking notes in [`../docs/architecture.md`](../docs/architecture.md)).
- The `parachute` CLI on PATH (`bun add -g @openparachute/cli`). Used to mint scoped tokens.

## What it does (TL;DR)

1. Asks where your vault lives + what scope the agent should have.
2. Mints a fresh `pvt_…` token via `parachute vault tokens create --scope <chosen>`.
3. Writes the vault MCP server entry into the agent group's runtime config.
4. Restarts the container.
5. Optionally creates a vault note that *is* the agent's identity (self-referential `claws/<name>` note pattern from [`../docs/architecture.md`](../docs/architecture.md)).

Reversal: `/remove-parachute` (companion skill, future).

## Status

- ✓ Skill drafted
- ☐ Validated against a running NanoClaw (Phase 0 smoke test)
- ☐ Companion `/remove-parachute` skill written
- ☐ Documented in NanoClaw upstream's skill catalog (PR to qwibitai/nanoclaw)

See [`../docs/phase-a-skill.md`](../docs/phase-a-skill.md) for the full reference.
