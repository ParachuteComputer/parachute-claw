/**
 * Thin Parachute Vault HTTP client used by the runtime.
 *
 * The vault is the substrate. Everything an agent reads or writes flows
 * through here. Endpoints follow the vault's existing REST surface:
 *
 *   GET    /vault/<name>/api/notes?path_prefix=…   list / query
 *   GET    /vault/<name>/api/notes/<idOrPath>      single note
 *   POST   /vault/<name>/api/notes                 create
 *   PATCH  /vault/<name>/api/notes/<idOrPath>      update
 *   DELETE /vault/<name>/api/notes/<idOrPath>      delete
 *
 * Auth: Bearer pvt_… token in the Authorization header (scoped via the
 * Parachute vault tokens system — typically `vault:write` for an agent).
 */

export interface VaultConfig {
  baseUrl: string; // e.g. http://127.0.0.1:1940/vault/default
  token: string; // pvt_…
}

export interface Note {
  id: string;
  path?: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export class VaultError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "VaultError";
    this.status = status;
    this.body = body;
  }
}

export class VaultClient {
  constructor(private readonly cfg: VaultConfig) {}

  private async fetch<T>(
    path: string,
    init?: RequestInit & { query?: Record<string, string | number | boolean | undefined> },
  ): Promise<T> {
    const url = new URL(`${this.cfg.baseUrl}${path}`);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let parsed: unknown = body;
      try {
        parsed = JSON.parse(body);
      } catch {
        // not JSON; leave as text
      }
      throw new VaultError(
        `vault ${init?.method ?? "GET"} ${path} → ${res.status}`,
        res.status,
        parsed,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** List notes whose path starts with the given prefix. */
  async listByPrefix(pathPrefix: string, limit = 100): Promise<readonly Note[]> {
    const result = await this.fetch<{ notes?: Note[] } | Note[]>("/api/notes", {
      query: { path_prefix: pathPrefix, limit },
    });
    if (Array.isArray(result)) return result;
    return result.notes ?? [];
  }

  /** Get a single note by id or path. Returns null on 404. */
  async getByPath(idOrPath: string): Promise<Note | null> {
    try {
      return await this.fetch<Note>(`/api/notes/${encodeURIComponent(idOrPath)}`);
    } catch (err) {
      if (err instanceof VaultError && err.status === 404) return null;
      throw err;
    }
  }

  /** Create a note. */
  async create(input: {
    path: string;
    content: string;
    tags?: readonly string[];
    metadata?: Record<string, unknown>;
  }): Promise<Note> {
    return this.fetch<Note>("/api/notes", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Patch a note's content / metadata / tags / path (renames). */
  async update(
    idOrPath: string,
    patch: Partial<Pick<Note, "content" | "tags" | "metadata" | "path">>,
  ): Promise<Note> {
    return this.fetch<Note>(`/api/notes/${encodeURIComponent(idOrPath)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  /** Delete a note. */
  async delete(idOrPath: string): Promise<void> {
    await this.fetch<void>(`/api/notes/${encodeURIComponent(idOrPath)}`, {
      method: "DELETE",
    });
  }
}
