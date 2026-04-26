/**
 * Paraclaw orchestration server entrypoint.
 *
 * Reads a vault admin token + URL from env (or args), boots the vault client,
 * and serves the UI's REST surface on the chosen port.
 *
 * Env:
 *   PORT                 — listen port (default 1944; not yet in
 *                           PORT_RESERVATIONS — claim at first RC per
 *                           parachute-patterns/patterns/canonical-ports.md)
 *   PARACLAW_BIND        — bind hostname (default 127.0.0.1)
 *   PARACLAW_VAULT_URL   — vault base URL (default http://127.0.0.1:1940/vault/default)
 *   PARACLAW_VAULT_TOKEN — vault admin token (required for v1; OAuth flow
 *                          replaces this in Phase B)
 */
import { route, type RouteCtx } from "./routes.ts";
import { VaultClient } from "./vault.ts";

const PORT = Number(process.env.PORT ?? 1944);
const HOST = process.env.PARACLAW_BIND ?? "127.0.0.1";
const VAULT_URL =
  process.env.PARACLAW_VAULT_URL ?? "http://127.0.0.1:1940/vault/default";
const VAULT_TOKEN = process.env.PARACLAW_VAULT_TOKEN;

if (!VAULT_TOKEN) {
  console.error(
    "[paraclaw-server] PARACLAW_VAULT_TOKEN is required. Mint one with:\n" +
      "  parachute vault tokens create --scope vault:admin --label paraclaw-server\n" +
      "Then export PARACLAW_VAULT_TOKEN=<token> before starting the server.",
  );
  process.exit(2);
}

const vault = new VaultClient({ baseUrl: VAULT_URL, token: VAULT_TOKEN });
const ctx: RouteCtx = { vault };

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: (req) => route(req, ctx),
});

console.log(`paraclaw-server listening on http://${server.hostname}:${server.port}`);
console.log(`  vault: ${VAULT_URL}`);
console.log(`  routes: GET /health, GET/POST /api/agents, GET /api/agents/:n[/runs], POST /api/agents/:n/send`);
