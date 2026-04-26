/**
 * Paraclaw server entrypoint.
 *
 * Phase B skeleton — see ../README.md and ../../docs/architecture.md.
 *
 * Today this just listens, returns 200 on /health, and 501 with a doc-pointer
 * on everything else. The skeleton is here so the file structure is set when
 * the real implementation lands.
 */
import { route } from "./routes.ts";

const PORT = Number(process.env.PORT ?? 1944);
const HOST = process.env.PARACLAW_BIND ?? "127.0.0.1";

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: route,
});

console.log(`Paraclaw server listening on http://${server.hostname}:${server.port}`);
console.log("  /health           → 200 ok");
console.log("  /api/agents       → 501 (Phase B; see docs/ui-design.md)");
console.log("  /api/oauth/*      → 501 (Phase B; see docs/architecture.md §B.2)");
