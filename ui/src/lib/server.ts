/**
 * HTTP client to the Paraclaw server (../../server/).
 * Phase B placeholder. Returns typed errors when the server replies 501.
 */

const SERVER_BASE =
  (import.meta.env.VITE_PARACLAW_SERVER_URL as string | undefined) ??
  "/api";

export interface AgentRow {
  name: string;
  scope: string;
  channels: string[];
  lastActivityAt?: string;
  paused: boolean;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? `${res.status} ${String(body.error)}`
        : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchAgents(): Promise<AgentRow[]> {
  return get<AgentRow[]>("/agents");
}
