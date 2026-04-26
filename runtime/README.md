# runtime/

The Paraclaw agent loop. Bun + Claude Agent SDK + a thin vault HTTP client.

## What it does

1. Loads the agent's identity from `claws/<name>` in vault.
2. Polls `claws/<name>/inbox/` for new messages.
3. For each, runs Claude Agent SDK with the identity as system prompt and the message as user prompt. The vault MCP server is wired in by default (all nine tools).
4. Writes the response to `claws/<name>/outbox/` (channels read here for delivery).
5. Records the run at `claws/<name>/runs/<run-id>` (full provenance).
6. Marks the inbox note processed (moves to `inbox/processed/`).

## Run

```sh
cd runtime
bun install

# One-shot — process whatever's in the inbox once and exit.
bun src/cli.ts run my-agent \
  --vault-url http://127.0.0.1:1940/vault/default \
  --vault-token pvt_... \
  --once

# Steady-state — loop forever, polling every 5s.
bun src/cli.ts run my-agent \
  --vault-url http://127.0.0.1:1940/vault/default \
  --vault-token pvt_...

# Or use env:
export PARACLAW_VAULT_URL=http://127.0.0.1:1940/vault/default
export PARACLAW_VAULT_TOKEN=pvt_...
bun src/cli.ts run my-agent
```

## Required setup before running

You need a `claws/<name>` note in your vault. The note's content is the agent's system prompt — its persona, its tools, its constraints. Create it via:

- The Paraclaw UI's "+ New agent" wizard (Phase B), or
- Notes' note-editor at `/notes/`, or
- The vault HTTP API directly:
  ```sh
  curl -X POST http://127.0.0.1:1940/vault/default/api/notes \
    -H "Authorization: Bearer pvt_..." \
    -H "Content-Type: application/json" \
    -d '{
      "path": "claws/my-agent",
      "content": "You are a helpful assistant. Use vault tools to remember and recall.",
      "tags": ["claw"]
    }'
  ```

## Triggering a message (no real channels yet)

In v1, send a test message by writing to the inbox directly:

```sh
curl -X POST http://127.0.0.1:1940/vault/default/api/notes \
  -H "Authorization: Bearer pvt_..." \
  -H "Content-Type: application/json" \
  -d '{
    "path": "claws/my-agent/inbox/'"$(date +%s)"'-cli",
    "content": "Hello! Can you write a note about today and tag it #demo?",
    "tags": ["claw", "claw:inbox"],
    "metadata": { "source": "cli" }
  }'
```

The runtime picks this up on its next poll and processes it.

## Tags

Convention used by the runtime (so you can query agent state from anywhere):

- `claw` — anything claw-related
- `claw:<agent-name>` — scoped to one agent
- `claw:inbox` / `claw:outbox` / `claw:run` — by location in the agent's tree
- `claw:source:<source>` — which channel originated the message
- `claw:run:ok` / `claw:run:error` — run outcome

## What this isn't

- Not a daemon manager. The runtime exits when you tell it to (or never, in steady-state). Lifecycle (start/stop/restart) lives in the server.
- Not channel-aware. The runtime only knows about vault notes. Channels are MCPs (or small bridges) that translate between external transports and the inbox/outbox notes.
- Not multi-agent. One process = one agent. The server can spawn multiple processes as needed.
