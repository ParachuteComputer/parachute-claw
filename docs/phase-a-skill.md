# Phase A — the NanoClaw skill

> Reference for the `/add-parachute` skill. Status: design + draft. Validation against a running NanoClaw still pending (Phase 0).

## What it does

Wires a Parachute Vault into a NanoClaw agent group as an MCP server, with a scoped token chosen at install time.

## Where it lives

In a NanoClaw fork:

```
nanoclaw/
└── .claude/
    └── skills/
        └── add-parachute.md       ← what this repo's skill/ ships
```

The skill is a CLAUDE.md-flavored prompt that Claude Code runs when the user types `/add-parachute`. It's a script written in natural language.

## Install — manual today

Until we have an installer, the manual path is:

```sh
# 1. In your NanoClaw fork:
mkdir -p .claude/skills

# 2. Copy the skill:
curl -sL https://raw.githubusercontent.com/ParachuteComputer/parachute-claw/main/skill/add-parachute.md \
  > .claude/skills/add-parachute.md

# 3. Inside Claude Code:
/add-parachute
```

We'll ship a `parachute claw install` CLI command in Phase B so this becomes a one-liner.

## Skill flow (what `/add-parachute` does)

The skill prompts Claude Code to do, in order:

1. **Locate the NanoClaw agent group.** Check `~/.nanoclaw/` (or wherever NanoClaw installs) for the agent groups present. If multiple, ask which to wire. If the user is mid-`new-agent` flow, install for that one.
2. **Ask for vault location.** Default `http://127.0.0.1:1940/vault/default` (loopback). If NanoClaw containers are bridged (not host-networked), fall back to asking for a tailnet or public URL.
3. **Detect networking shape.** Check if the NanoClaw container is host-networked. If not, recommend `parachute expose tailnet` (private to user's tailnet) or `parachute expose public` (Tailscale Funnel) and offer to run that command.
4. **Ask scope.** Default `vault:read`. Options are `vault:read` / `vault:write` / `vault:admin`. Explain in human terms what each lets the agent do.
5. **Mint token.** Run:
   ```sh
   parachute vault tokens create --scope <scope> --label "claw-<agent-group-name>"
   ```
   Capture the `pvt_…` from output.
6. **Write MCP config.** Append (or upsert) the MCP server entry to the agent group's runtime config. NanoClaw's container reads `.mcp.json` (or whatever path the agent runner uses); the skill writes there:
   ```json
   {
     "mcpServers": {
       "parachute-vault": {
         "transport": { "type": "http", "url": "<vault-url>/mcp" },
         "headers": { "Authorization": "Bearer pvt_..." }
       }
     }
   }
   ```
7. **(Optional) Vault-as-CLAUDE.md.** Offer to create a `claws/<agent-group-name>` note in the vault containing the agent's current `CLAUDE.md`, then update the agent's `CLAUDE.md` to read from that note on startup. Self-referential identity. Default: skip — it's a power move, not a starting point.
8. **Restart the agent's container.** NanoClaw provides a restart mechanism per agent group; the skill invokes it.
9. **Smoke test.** Send a test message via the agent's primary channel (or directly to its inbound queue). Expect the agent to respond and confirm it can see vault tools.

## Reversal

`/remove-parachute` (companion skill, future): removes the MCP entry, revokes the token via `parachute vault tokens revoke`, optionally deletes the `claws/<agent-group-name>` vault note.

## Failure modes & guidance

- **Vault unreachable from container** (loopback resolution fails): skill explains the host-networking vs. bridge-networking distinction and offers to switch the agent group to host-networked, OR to expose vault via Tailscale.
- **Token mint fails** (no `parachute` CLI in PATH): skill prompts the user to install `parachute-cli` first.
- **Agent group already has Parachute MCP wired** (re-install): skill detects, offers to update / replace the token, asks before destructive ops.
- **MCP config file format ambiguity** (NanoClaw's exact config path / format may vary by version): skill verifies the format on first run and prints the diff before writing.

## Why a Claude-Code-driven skill instead of a TypeScript script

- **NanoClaw's design philosophy.** "No configuration files, modify code via Claude Code." Following the skill pattern matches upstream's expectations.
- **Reversibility.** The user can read the skill, understand what it'll do, and intervene at any step. A bash script is opaque.
- **Composability.** Other Parachute skills (`/add-parachute-scribe` for vault-routed transcription? `/add-parachute-channel` for more channel adapters?) follow the same shape.
- **Adaptation.** If NanoClaw's config format shifts, the skill is markdown — Claude Code adapts. A compiled script breaks.

## Open questions for Phase 0 validation

- Exact path NanoClaw uses for per-agent-group MCP config. (Likely `~/.nanoclaw/groups/<name>/.mcp.json` or similar; verify against a real install.)
- How NanoClaw expects to be told "restart this agent group's container." (CLI command? File touch? Process signal?)
- Does the agent runner inside the container resolve `127.0.0.1:1940` to host loopback, or to its own loopback? (Container networking, see `architecture.md` Networking section.)
- Whether NanoClaw's existing `/add-<thing>` skills install into `.claude/skills/` or a different path.

These get answered when we install NanoClaw and inspect. Phase 0 is the next step.
