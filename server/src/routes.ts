/**
 * Paraclaw HTTP routes.
 *
 * The server is a thin orchestrator over vault. Most routes read or write
 * vault notes via the `agents` module; OAuth (`/oauth/*`) is the one that
 * holds local state.
 *
 * Auth model for v1: server boots with a vault admin token (env var or
 * config file). UI calls go through the server, server uses its admin
 * token to act on behalf of the user. Phase B replaces this with OAuth
 * handshake — the server registers as an OAuth client of vault, the user
 * approves once, server holds the resulting admin token.
 */
import {
  createAgent,
  getAgent,
  listAgents,
  listRuns,
  sendInboxMessage,
} from "./agents.ts";
import { VaultClient, VaultError } from "./vault.ts";

export interface RouteCtx {
  vault: VaultClient;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      ...(init?.headers ?? {}),
    },
  });

const error = (message: string, status = 500) => json({ error: message }, { status });

const handleVaultError = (err: unknown): Response => {
  if (err instanceof VaultError) {
    return json({ error: "vault_error", status: err.status, body: err.body }, { status: err.status });
  }
  return error(err instanceof Error ? err.message : String(err), 500);
};

export async function route(req: Request, ctx: RouteCtx): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight — echo the same allow-list from json() above.
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "Content-Type, Authorization",
        "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      },
    });
  }

  if (path === "/health" && method === "GET") {
    return json({ service: "paraclaw-server", version: "0.0.1", status: "ok" });
  }

  // GET /api/agents
  if (path === "/api/agents" && method === "GET") {
    try {
      const agents = await listAgents(ctx.vault);
      return json({ agents });
    } catch (err) {
      return handleVaultError(err);
    }
  }

  // POST /api/agents — new agent
  if (path === "/api/agents" && method === "POST") {
    try {
      const body = (await req.json()) as {
        name?: string;
        systemPrompt?: string;
        scopes?: string[];
        channels?: string[];
      };
      if (!body.name || !body.systemPrompt) {
        return error("name and systemPrompt are required", 400);
      }
      const agent = await createAgent(ctx.vault, {
        name: body.name,
        systemPrompt: body.systemPrompt,
        scopes: body.scopes ?? ["vault:read"],
        channels: body.channels ?? [],
      });
      return json({ agent }, { status: 201 });
    } catch (err) {
      return handleVaultError(err);
    }
  }

  // /api/agents/:name and sub-routes
  const agentMatch = path.match(/^\/api\/agents\/([^/]+)(\/.*)?$/);
  if (agentMatch) {
    const name = decodeURIComponent(agentMatch[1]);
    const sub = agentMatch[2] ?? "";

    // GET /api/agents/:name
    if (sub === "" && method === "GET") {
      try {
        const agent = await getAgent(ctx.vault, name);
        if (!agent) return error("agent not found", 404);
        return json({ agent });
      } catch (err) {
        return handleVaultError(err);
      }
    }

    // GET /api/agents/:name/runs
    if (sub === "/runs" && method === "GET") {
      try {
        const runs = await listRuns(ctx.vault, name);
        return json({ runs });
      } catch (err) {
        return handleVaultError(err);
      }
    }

    // POST /api/agents/:name/send — write an inbox message (the test path)
    if (sub === "/send" && method === "POST") {
      try {
        const body = (await req.json()) as {
          content?: string;
          source?: string;
          from?: string;
        };
        if (!body.content) return error("content is required", 400);
        const result = await sendInboxMessage(ctx.vault, name, {
          content: body.content,
          source: body.source,
          from: body.from,
        });
        return json(result, { status: 201 });
      } catch (err) {
        return handleVaultError(err);
      }
    }
  }

  return json({ error: "not_found", path }, { status: 404 });
}
