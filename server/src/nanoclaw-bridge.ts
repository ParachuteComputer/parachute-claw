/**
 * NanoClaw bridge — read NanoClaw's state, mutate it via its CLI.
 * Phase B placeholder.
 *
 * Read side:
 *   - listAgentGroups() — names + container status + channels + last activity
 *   - readMessageHistory(agentGroup, limit) — the "Recent activity" stream
 *   - readSchedules(agentGroup) — cron entries + next-run + last-run
 *
 *   These read NanoClaw's per-session SQLite files (inbound.db / outbound.db)
 *   plus its top-level state. We do NOT write to NanoClaw's SQLite directly;
 *   NanoClaw owns those files.
 *
 * Mutation side (shell out to nanoclaw CLI):
 *   - createAgentGroup(name, config) — wizard endpoint
 *   - removeAgentGroup(name) — kill-switch endpoint
 *   - restartAgentGroup(name) — token rotation, config update
 *   - setSchedule(agentGroup, cron, action) — schedule editing
 *
 *   Mutations always go through `nanoclaw` CLI commands. Failures surface as
 *   typed errors that the route handlers can render in the UI.
 *
 * Stability:
 *   This bridge is the most likely point of fragility — NanoClaw's SQLite
 *   schema and CLI interface aren't guaranteed stable. Pin to NanoClaw
 *   versions, test in CI, surface contract breaks loudly. If volatility
 *   becomes a recurring problem, escalate to a soft-fork of NanoClaw (see
 *   docs/phase-b-vision.md §Shape 2).
 */

import { NotImplemented } from "./oauth.ts";

export interface AgentGroupSummary {
  name: string;
  containerStatus: "running" | "stopped" | "unknown";
  channels: readonly string[];
  scopes: readonly string[];
  lastActivityAt?: string;
  paused: boolean;
}

export interface NanoClawBridge {
  listAgentGroups(): Promise<readonly AgentGroupSummary[]>;
  readMessageHistory(
    agentGroup: string,
    limit: number,
  ): Promise<readonly unknown[]>;
  readSchedules(agentGroup: string): Promise<readonly unknown[]>;
  createAgentGroup(name: string, config: unknown): Promise<void>;
  removeAgentGroup(name: string): Promise<void>;
  restartAgentGroup(name: string): Promise<void>;
  setSchedule(agentGroup: string, cron: string, action: unknown): Promise<void>;
}

export function createNanoClawBridge(): NanoClawBridge {
  const stub: NanoClawBridge = {
    listAgentGroups: () =>
      Promise.reject(new NotImplemented("nanoclaw.listAgentGroups — Phase B")),
    readMessageHistory: () =>
      Promise.reject(new NotImplemented("nanoclaw.readMessageHistory — Phase B")),
    readSchedules: () =>
      Promise.reject(new NotImplemented("nanoclaw.readSchedules — Phase B")),
    createAgentGroup: () =>
      Promise.reject(new NotImplemented("nanoclaw.createAgentGroup — Phase B")),
    removeAgentGroup: () =>
      Promise.reject(new NotImplemented("nanoclaw.removeAgentGroup — Phase B")),
    restartAgentGroup: () =>
      Promise.reject(new NotImplemented("nanoclaw.restartAgentGroup — Phase B")),
    setSchedule: () =>
      Promise.reject(new NotImplemented("nanoclaw.setSchedule — Phase B")),
  };
  return stub;
}
