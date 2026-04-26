/**
 * The Paraclaw "agent" view, materialized from vault notes.
 *
 * An agent is a vault note tree:
 *   claws/<name>                    — identity (system prompt + frontmatter)
 *   claws/<name>/inbox/...          — incoming messages
 *   claws/<name>/inbox/processed/.. — processed inbox messages
 *   claws/<name>/outbox/...         — outgoing messages
 *   claws/<name>/runs/<run-id>      — run records
 *
 * The server reads this tree on demand. It writes new agents (creates the
 * `claws/<name>` note + frontmatter) and writes test inbox messages on
 * behalf of the UI's "send" form.
 */
import { VaultClient, type Note } from "./vault.ts";

export interface AgentSummary {
  name: string;
  identity: { content: string; metadata: Record<string, unknown> };
  channels: readonly string[];
  scopes: readonly string[];
  paused: boolean;
  inboxPending: number;
  lastRun?: {
    runId: string;
    status: "ok" | "error";
    finishedAt?: string;
    summary?: string;
  };
}

export interface RunSummary {
  runId: string;
  agentName: string;
  status: "ok" | "error";
  source: string;
  startedAt?: string;
  finishedAt?: string;
  summary: string;
  outboxNotePath?: string;
  inboxNotePath?: string;
}

/** Strip the `claws/<name>` prefix from a path; returns the leaf name. */
function agentNameFromIdentityPath(path: string): string | null {
  // Identity notes live at exactly `claws/<name>` (no trailing slash, no
  // sub-segments). Anything deeper is part of the agent's tree.
  const m = path.match(/^claws\/([^/]+)$/);
  return m ? m[1] : null;
}

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const asBoolean = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;

/** Find every claws/<name> identity note. */
export async function listAgents(vault: VaultClient): Promise<readonly AgentSummary[]> {
  const allUnderClaws = await vault.listByPrefix("claws/", 1000);
  const identities = allUnderClaws.filter((n) =>
    n.path ? agentNameFromIdentityPath(n.path) !== null : false,
  );

  const summaries: AgentSummary[] = [];
  for (const id of identities) {
    if (!id.path) continue;
    const name = agentNameFromIdentityPath(id.path)!;
    const summary = await summarizeAgent(vault, id, allUnderClaws);
    summary.name = name;
    summaries.push(summary);
  }
  return summaries;
}

/** Detail view of one agent (identity + recent runs + inbox depth). */
export async function getAgent(
  vault: VaultClient,
  name: string,
): Promise<AgentSummary | null> {
  const identity = await vault.getByPath(`claws/${name}`);
  if (!identity) return null;
  const allUnderClaws = await vault.listByPrefix(`claws/${name}/`, 1000);
  const summary = await summarizeAgent(vault, identity, allUnderClaws);
  summary.name = name;
  return summary;
}

async function summarizeAgent(
  _vault: VaultClient,
  identity: Note,
  allUnderClaws: readonly Note[],
): Promise<AgentSummary> {
  const meta = identity.metadata ?? {};
  const channels = stringArray(meta.claw_channels);
  const scopes = stringArray(meta.claw_scopes);
  const paused = asBoolean(meta.claw_paused, false);

  const name = identity.path ? agentNameFromIdentityPath(identity.path) ?? "" : "";

  const inboxPending = allUnderClaws.filter(
    (n) =>
      n.path?.startsWith(`claws/${name}/inbox/`) &&
      !n.path?.includes("/processed/"),
  ).length;

  const runs = allUnderClaws
    .filter((n) => n.path?.startsWith(`claws/${name}/runs/`))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const last = runs[0];
  const lastRun = last
    ? {
        runId: asString(last.metadata?.runId) ?? "",
        status: (asString(last.metadata?.status) ?? "ok") as "ok" | "error",
        finishedAt: asString(last.metadata?.finishedAt),
        summary: last.content,
      }
    : undefined;

  return {
    name,
    identity: { content: identity.content, metadata: meta as Record<string, unknown> },
    channels,
    scopes,
    paused,
    inboxPending,
    lastRun,
  };
}

/** Recent runs for an agent, newest first. */
export async function listRuns(
  vault: VaultClient,
  name: string,
  limit = 50,
): Promise<readonly RunSummary[]> {
  const runs = await vault.listByPrefix(`claws/${name}/runs/`, limit);
  return runs
    .map((n) => ({
      runId: asString(n.metadata?.runId) ?? n.path?.split("/").pop() ?? "",
      agentName: name,
      status: (asString(n.metadata?.status) ?? "ok") as "ok" | "error",
      source:
        asString(
          (n.metadata?.triggeredBy as Record<string, unknown> | undefined)?.source,
        ) ?? "unknown",
      startedAt: asString(n.metadata?.startedAt),
      finishedAt: asString(n.metadata?.finishedAt),
      summary: n.content,
      outboxNotePath: asString(n.metadata?.outboxNotePath),
      inboxNotePath: asString(
        (n.metadata?.triggeredBy as Record<string, unknown> | undefined)?.inboxNotePath,
      ),
    }))
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

/** Create a new agent (the identity note). */
export async function createAgent(
  vault: VaultClient,
  input: {
    name: string;
    systemPrompt: string;
    scopes: readonly string[];
    channels?: readonly string[];
  },
): Promise<AgentSummary> {
  const path = `claws/${input.name}`;
  const existing = await vault.getByPath(path);
  if (existing) {
    throw new Error(`agent "${input.name}" already exists`);
  }
  await vault.create({
    path,
    content: input.systemPrompt,
    tags: ["claw", `claw:${input.name}`, "claw:identity"],
    metadata: {
      claw_scopes: input.scopes,
      claw_channels: input.channels ?? [],
      claw_paused: false,
      claw_token_label: `claw-${input.name}`,
    },
  });
  return (await getAgent(vault, input.name))!;
}

/** Append an inbox message; the runtime picks it up on its next poll. */
export async function sendInboxMessage(
  vault: VaultClient,
  agentName: string,
  message: { content: string; source?: string; from?: string },
): Promise<{ path: string }> {
  const ts = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const source = message.source ?? "cli";
  const path = `claws/${agentName}/inbox/${ts}-${source}`;
  await vault.create({
    path,
    content: message.content,
    tags: ["claw", `claw:${agentName}`, "claw:inbox", `claw:source:${source}`],
    metadata: {
      source,
      from: message.from,
      sentAt: new Date().toISOString(),
    },
  });
  return { path };
}
