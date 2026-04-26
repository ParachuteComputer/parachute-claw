# /add-parachute — wire a Parachute Vault into this agent group

> Skill that runs inside Claude Code in a NanoClaw fork. Composes a Parachute Vault as an MCP server for the active agent group, with a scoped vault token chosen at install time.

## What you (Claude Code) should do when the user invokes `/add-parachute`

Walk the user through the steps below in order. Pause at each prompt and confirm before mutating anything. Print a clear summary at the end.

### Step 1 — Identify the agent group

Locate the NanoClaw agent group to wire. NanoClaw stores agent-group state under a per-user data directory (typically `~/.nanoclaw/`, but verify against the user's install).

- If the working directory is inside a NanoClaw fork's `.claude/skills/`, the active agent group is most likely the one the user is currently configuring or last interacted with. Check NanoClaw's `current` or `active` marker if one exists.
- If multiple groups exist and no marker, list them and ask the user to pick.
- If no agent groups exist, stop and tell the user to create one first via NanoClaw's `/new-agent` (or equivalent) skill.

Capture: `$AGENT_GROUP_NAME` and `$AGENT_GROUP_PATH`.

### Step 2 — Locate or prompt for vault URL

Default: `http://127.0.0.1:1940/vault/default/mcp`.

Detect networking shape:

- Check whether the agent group's container runs with host networking. NanoClaw stores this in the group's container config; look for a `--network host` flag or equivalent.
- **Host-networked**: loopback URL works; default is fine.
- **Bridge-networked**: loopback won't reach the host's vault. Tell the user, and offer two fallbacks:
  1. **Tailnet exposure**: run `parachute expose tailnet` (asks the user; explain it makes the vault reachable to all their tailnet devices). Take the resulting `https://<machine>.<tailnet>.ts.net/vault/default/mcp` URL.
  2. **Public exposure**: run `parachute expose public` (Tailscale Funnel — explain the public-internet implication). Take the resulting URL.
  3. **Switch to host-networked**: offer to update the agent group's container config. Lower friction but reduces isolation; explain the trade-off.

Capture: `$VAULT_URL` (the full MCP endpoint, ending in `/mcp`).

Verify reachability before proceeding: try a `curl -fsS $VAULT_URL` from the host (or from inside the container if practical). On failure, surface the specific error and pause for the user's input — don't mutate anything.

### Step 3 — Choose the scope

Ask the user which scope this agent should have:

- **`vault:read`** — agent can query notes, list tags, traverse the graph. Cannot create or modify anything. Recommended default for research / summarization agents.
- **`vault:write`** — agent can create and update notes, manage tags. Cannot delete the vault itself or revoke other tokens. Recommended for personal-assistant agents that capture for you.
- **`vault:admin`** — full vault access, including the ability to mint and revoke other tokens. Use sparingly; recommended only for sysadmin agents the user trusts as themselves.

Default the prompt to `vault:read`. Make sure the user picks consciously before proceeding.

Capture: `$SCOPE`.

### Step 4 — Mint the token

Run:

```sh
parachute vault tokens create --scope "$SCOPE" --label "claw-$AGENT_GROUP_NAME"
```

This produces a `pvt_…` token. Capture it as `$TOKEN`.

If the `parachute` CLI is not on PATH, stop and tell the user to install it first:

```sh
bun add -g @openparachute/cli
```

If the CLI is present but the command fails (e.g., vault not running), surface the error and pause.

### Step 5 — Write the MCP config

Find the agent group's MCP config. NanoClaw configures MCP servers per agent runner; the file is typically `<AGENT_GROUP_PATH>/.mcp.json` or similar. **Verify the actual path against the user's NanoClaw version** — don't assume.

Read the existing config (or create an empty `{}` if none). Add or replace the `parachute-vault` entry:

```json
{
  "mcpServers": {
    "parachute-vault": {
      "transport": {
        "type": "http",
        "url": "<VAULT_URL>"
      },
      "headers": {
        "Authorization": "Bearer <TOKEN>"
      }
    }
  }
}
```

(If NanoClaw's MCP config uses a different shape — `command`-based stdio MCP, for instance — adapt. The Parachute Vault MCP is HTTP-transport, so HTTP is the right shape; if NanoClaw's runner doesn't support HTTP MCP, surface that gap clearly and stop.)

Show the diff to the user before writing. Get confirmation. Then write atomically (temp file + rename).

### Step 6 — Optional: vault-as-CLAUDE.md

Ask the user: *"Would you like the agent's CLAUDE.md to live in your vault as a note (path: `claws/$AGENT_GROUP_NAME`)? This means editing the note in any vault client updates the agent on next message."*

Default: No. Explain that this is a power move — useful but easy to misuse if the user isn't already comfortable with the vault's note model.

If yes:

```sh
# Read current CLAUDE.md
CLAUDE_MD=$(cat "$AGENT_GROUP_PATH/CLAUDE.md")

# Create vault note via parachute CLI (or the vault HTTP API if the CLI doesn't expose this)
# Path: claws/<agent-group-name>
# Content: the CLAUDE.md text
# Frontmatter: claw_token_label, claw_scopes, claw_channels (best-effort discovery from NanoClaw)
```

Then update the agent's CLAUDE.md to reference the vault note as its source of truth. (Exact mechanic depends on NanoClaw — for a Claude Agent SDK runner, this might be a `system` prompt that fetches the vault note on each turn via the now-available `query-notes` MCP tool.)

### Step 7 — Restart the container

Use NanoClaw's restart mechanism for the agent group. (Likely `nanoclaw restart $AGENT_GROUP_NAME` or equivalent — verify against the user's install.)

Wait for the container to come back up. Verify the agent runner can see the new MCP server: send a test query that requires vault access (e.g., "list the tags in my vault") and confirm a sensible response.

### Step 8 — Summary + reversal note

Print a summary block:

```
✓ Wired Parachute Vault into agent group "<AGENT_GROUP_NAME>"

  Vault URL:    <VAULT_URL>
  Scope:        <SCOPE>
  Token label:  claw-<AGENT_GROUP_NAME>
  Token:        <TOKEN>  (save this; not retrievable later)

  MCP config updated:    <AGENT_GROUP_PATH>/.mcp.json
  Container restarted:   ✓
  Smoke test:            ✓  (agent saw N tags via vault MCP)

To revoke later:
  parachute vault tokens revoke claw-<AGENT_GROUP_NAME>

To remove the integration entirely:
  /remove-parachute  (companion skill — future; for now, edit .mcp.json by hand)
```

Print this once, clearly. Then stop. Don't keep talking.

## Failure modes — what to do

- **Vault unreachable**: surface the exact error, pause. Do not mutate anything.
- **Token mint fails**: surface, pause. Common causes: vault not running, no admin password set, etc.
- **MCP config exists with a `parachute-vault` entry already**: detect, ask if user wants to replace. Default no.
- **Container won't restart**: surface NanoClaw's error, leave config in place, tell user to investigate. They can roll back by deleting the `parachute-vault` entry from `.mcp.json` and restarting again.

## Reversal

The companion `/remove-parachute` skill is not yet implemented. For now, manual reversal is:

```sh
# 1. Edit .mcp.json, remove the "parachute-vault" entry
# 2. Revoke the token
parachute vault tokens revoke claw-$AGENT_GROUP_NAME
# 3. (Optional) Delete the claws/$AGENT_GROUP_NAME vault note if you created one
parachute vault delete-note claws/$AGENT_GROUP_NAME
# 4. Restart the agent group's container
nanoclaw restart $AGENT_GROUP_NAME
```

## Notes for Claude Code maintaining this skill

- This skill is markdown by design — easy to read, easy to modify. If NanoClaw's config format changes, update the skill rather than calcifying a script.
- Don't paste tokens into commit messages, logs, or anywhere they'd be readable later. The `Bearer pvt_…` line in `.mcp.json` is the only place the token should land.
- If the user is mid-conversation in another agent group when they invoke this, ask them to confirm which group they want; don't assume.
