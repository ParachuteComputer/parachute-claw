/**
 * HTTP client to the Paraclaw server.
 *
 * Default base path is `/api` (relative — Vite dev-proxy forwards to the
 * server at localhost:1944; in production both are served from the same
 * origin under /claw/). Override with `VITE_PARACLAW_SERVER_URL` for the
 * "UI on laptop, server on home machine" Phase B.5 case.
 */

const SERVER_BASE =
  (import.meta.env.VITE_PARACLAW_SERVER_URL as string | undefined) ?? "/api";

export interface AgentSummary {
  name: string;
  identity: { content: string; metadata: Record<string, unknown> };
  channels: string[];
  scopes: string[];
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

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  let body: BodyInit | undefined = init?.body as BodyInit | undefined;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${SERVER_BASE}${path}`, { ...init, headers, body });
  if (!res.ok) {
    const text = await res.text();
    let message: string = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; status?: number };
      if (parsed.error) message = parsed.error;
    } catch {
      // not JSON, fine
    }
    throw new Error(`${res.status} ${message}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function fetchAgents(): Promise<AgentSummary[]> {
  const result = await request<{ agents: AgentSummary[] }>("/agents");
  return result.agents;
}

export async function fetchAgent(name: string): Promise<AgentSummary> {
  const result = await request<{ agent: AgentSummary }>(`/agents/${encodeURIComponent(name)}`);
  return result.agent;
}

export async function fetchRuns(name: string): Promise<RunSummary[]> {
  const result = await request<{ runs: RunSummary[] }>(
    `/agents/${encodeURIComponent(name)}/runs`,
  );
  return result.runs;
}

export async function createAgent(input: {
  name: string;
  systemPrompt: string;
  scopes: string[];
  channels: string[];
}): Promise<AgentSummary> {
  const result = await request<{ agent: AgentSummary }>("/agents", {
    method: "POST",
    json: input,
  });
  return result.agent;
}

export async function sendMessage(
  name: string,
  content: string,
  source = "ui",
): Promise<{ path: string }> {
  return request<{ path: string }>(
    `/agents/${encodeURIComponent(name)}/send`,
    { method: "POST", json: { content, source } },
  );
}
