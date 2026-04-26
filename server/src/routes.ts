/**
 * Paraclaw HTTP routes — skeleton.
 *
 * Today: only /health responds. Everything else returns 501 with a pointer to
 * the relevant doc section so future contributors land in the right place.
 *
 * When implementation arrives, replace each 501 with the real handler. The
 * shape (route table → response) is deliberately simple so swapping in a
 * proper router (Hono, Elysia, native Bun) is a one-file refactor.
 */

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

const notImplemented = (docPath: string) =>
  json(
    {
      error: "not_implemented",
      doc: `https://github.com/ParachuteComputer/parachute-claw/blob/main/${docPath}`,
    },
    { status: 501 },
  );

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // /health — always responds. The one route that's real today.
  if (url.pathname === "/health") {
    return json({
      service: "paraclaw-server",
      version: "0.0.1",
      phase: "B-scaffold",
      status: "ok",
    });
  }

  // /api/agents — Phase B agent management
  if (url.pathname.startsWith("/api/agents")) {
    return notImplemented("docs/ui-design.md");
  }

  // /api/oauth/* — Phase B OAuth flow against vault
  if (url.pathname.startsWith("/api/oauth/")) {
    return notImplemented("docs/architecture.md");
  }

  // /api/tokens — Phase B token minting (admin-scoped operation)
  if (url.pathname.startsWith("/api/tokens")) {
    return notImplemented("docs/ui-design.md");
  }

  // /api/channels, /api/schedules — also Phase B
  if (url.pathname.startsWith("/api/")) {
    return notImplemented("docs/ui-design.md");
  }

  return json({ error: "not_found" }, { status: 404 });
}
