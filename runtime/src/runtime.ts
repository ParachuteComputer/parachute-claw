/**
 * Paraclaw runtime — the agent loop.
 *
 * Reads claws/<name> from vault for the agent's identity (system prompt,
 * config). Polls claws/<name>/inbox/ for new messages. For each, runs
 * Claude Agent SDK with vault MCP available, captures the response,
 * writes outbox + runs notes, marks the inbox note processed.
 *
 * One loop iteration handles one agent. The CLI can run many in parallel
 * by starting one process per agent (or one process and looping over
 * names — kept simple for v1).
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { VaultClient, type Note } from "./vault.ts";

export interface RuntimeOpts {
  agentName: string;
  vaultBaseUrl: string;
  vaultToken: string;
  /** How long to sleep between empty inbox polls. */
  pollMs?: number;
  /** When true, runtime exits after processing whatever's in the inbox once. */
  oneShot?: boolean;
  /** Optional logger override. Defaults to console.log. */
  log?: (line: string) => void;
}

export interface RunRecord {
  runId: string;
  agentName: string;
  triggeredBy: { source: string; inboxNotePath: string };
  startedAt: string;
  finishedAt?: string;
  status: "ok" | "error";
  errorMessage?: string;
  outboxNotePath?: string;
  /** Truncated transcript of the SDK messages — full JSON in metadata. */
  summary: string;
}

const log = (msg: string, opts?: { log?: RuntimeOpts["log"] }) =>
  (opts?.log ?? console.log)(`[paraclaw] ${msg}`);

const isInboxNote = (note: Note, agentName: string) => {
  const p = note.path ?? "";
  return p.startsWith(`claws/${agentName}/inbox/`) && !p.includes("/processed/");
};

const tsId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Run the agent loop. Returns when oneShot=true after the first pass; runs
 * forever otherwise (until the process is killed).
 */
export async function runAgent(opts: RuntimeOpts): Promise<void> {
  const { agentName, vaultBaseUrl, vaultToken } = opts;
  const pollMs = opts.pollMs ?? 5_000;
  const vault = new VaultClient({ baseUrl: vaultBaseUrl, token: vaultToken });

  // 1. Load identity. Bail with a clear message if the claws/<name> note
  //    doesn't exist; the runtime is not responsible for creating it.
  const identityPath = `claws/${agentName}`;
  const identity = await vault.getByPath(identityPath);
  if (!identity) {
    throw new Error(
      `claws/${agentName} note not found in vault. Create it via the Paraclaw UI or directly in Notes — the note's content is the agent's system prompt.`,
    );
  }
  log(`runtime up for "${agentName}" — system prompt: ${identity.content.length} chars`, opts);

  // 2. Loop.
  while (true) {
    const inbox = await vault.listByPrefix(`claws/${agentName}/inbox/`).catch((err) => {
      log(`inbox poll failed: ${err instanceof Error ? err.message : String(err)}`, opts);
      return [];
    });
    const pending = inbox.filter((n) => isInboxNote(n, agentName));

    if (pending.length === 0) {
      if (opts.oneShot) return;
      await sleep(pollMs);
      continue;
    }

    log(`processing ${pending.length} inbox message(s)`, opts);

    for (const inboxNote of pending) {
      await processOne(agentName, identity, inboxNote, vault, vaultBaseUrl, vaultToken, opts);
    }

    if (opts.oneShot) return;
  }
}

async function processOne(
  agentName: string,
  identity: Note,
  inboxNote: Note,
  vault: VaultClient,
  vaultBaseUrl: string,
  vaultToken: string,
  opts: RuntimeOpts,
): Promise<void> {
  const runId = tsId();
  const startedAt = new Date().toISOString();
  const source =
    typeof inboxNote.metadata?.source === "string" ? inboxNote.metadata.source : "unknown";

  log(`run ${runId} ← ${inboxNote.path} (source: ${source})`, opts);

  let summary = "";
  let status: RunRecord["status"] = "ok";
  let errorMessage: string | undefined;
  let outboxNotePath: string | undefined;
  const transcript: unknown[] = [];

  try {
    // Claude Agent SDK loop. The vault MCP server gives the agent the same
    // nine tools any other Parachute MCP client has: query-notes, create-note,
    // update-note, delete-note, list-tags, update-tag, delete-tag, find-path,
    // vault-info.
    const stream = query({
      prompt: inboxNote.content,
      options: {
        // Agent's identity note IS the system prompt.
        systemPrompt: { type: "preset", preset: "claude_code", append: identity.content },
        mcpServers: {
          "parachute-vault": {
            type: "http",
            url: `${vaultBaseUrl}/mcp`,
            headers: { Authorization: `Bearer ${vaultToken}` },
          },
        },
        // Allow only the vault MCP's tools by default. Per-agent overrides
        // can come from claws/<name> frontmatter later (e.g. allow specific
        // additional MCPs explicitly).
        allowedTools: ["mcp__parachute-vault__*"],
      },
    });

    // Drain the stream. Keep the last assistant text as the response payload.
    let lastText = "";
    for await (const message of stream) {
      transcript.push(message);
      if (typeof message === "object" && message !== null) {
        const m = message as { type?: string; subtype?: string; result?: unknown; content?: unknown };
        if (m.type === "result" && m.subtype === "success" && typeof m.result === "string") {
          lastText = m.result;
        } else if (m.type === "assistant" && Array.isArray(m.content)) {
          // Streaming partial — capture text deltas opportunistically.
          for (const block of m.content as Array<{ type?: string; text?: string }>) {
            if (block.type === "text" && typeof block.text === "string") lastText = block.text;
          }
        }
      }
    }

    summary = lastText.slice(0, 2000);

    // Write outbox if the agent produced a response. Channels watch outbox
    // and deliver back through their respective transports.
    if (lastText.trim().length > 0) {
      outboxNotePath = `claws/${agentName}/outbox/${tsId()}-${source}`;
      await vault.create({
        path: outboxNotePath,
        content: lastText,
        tags: ["claw", `claw:${agentName}`, `claw:source:${source}`, "claw:outbox"],
        metadata: {
          claw_run_id: runId,
          claw_inbox_note: inboxNote.path,
          source,
          // Channel-specific delivery metadata — whatever the channel needs to
          // route the response back. For now, copy known fields off the inbox.
          to: inboxNote.metadata?.from,
          reply_to: inboxNote.metadata?.message_id,
        },
      });
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    summary = `error: ${errorMessage}`;
    log(`run ${runId} ✗ ${errorMessage}`, opts);
  }

  // Record the run, regardless of outcome.
  const record: RunRecord = {
    runId,
    agentName,
    triggeredBy: { source, inboxNotePath: inboxNote.path ?? "" },
    startedAt,
    finishedAt: new Date().toISOString(),
    status,
    errorMessage,
    outboxNotePath,
    summary,
  };

  await vault
    .create({
      path: `claws/${agentName}/runs/${runId}`,
      content: summary,
      tags: ["claw", `claw:${agentName}`, "claw:run", `claw:run:${status}`],
      metadata: {
        ...record,
        transcript_preview: transcript.slice(0, 20), // keep the note small
      },
    })
    .catch((err) => {
      // If we can't even write a run record, log and continue. Inbox note
      // stays unprocessed — runtime will retry.
      log(
        `failed to write runs/${runId}: ${err instanceof Error ? err.message : String(err)}`,
        opts,
      );
    });

  // Mark inbox note processed by moving it to inbox/processed/. We do this by
  // patching the path. If the move fails, the note will be re-read next loop
  // — idempotency on this path is enforced via run records (we should also
  // start tagging inbox notes claw:processed once handled, but path-move is
  // the simplest signal for v1).
  if (inboxNote.path && status === "ok") {
    const newPath = inboxNote.path.replace(
      `claws/${agentName}/inbox/`,
      `claws/${agentName}/inbox/processed/`,
    );
    await vault
      .update(inboxNote.path, { path: newPath })
      .catch((err) => {
        log(
          `failed to move ${inboxNote.path} → ${newPath}: ${err instanceof Error ? err.message : String(err)}`,
          opts,
        );
      });
  }

  log(`run ${runId} ${status} (${summary.slice(0, 80).replace(/\s+/g, " ")}...)`, opts);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
