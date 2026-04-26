/**
 * OAuth client — Paraclaw is a registered OAuth client of the user's
 * Parachute Vault. Phase B placeholder.
 *
 * Flow (per docs/ui-design.md §OAuth flow):
 *   1. First-run RFC 7591 DCR against vault: /oauth/register → cache client_id
 *   2. User initiates: redirect to vault /oauth/authorize with PKCE challenge
 *   3. Callback at /api/oauth/callback exchanges code for token at /oauth/token
 *   4. Token persisted in paraclaw's SQLite, scoped vault:admin (token-minting)
 *   5. Per-agent tokens minted on demand via vault's API or `parachute vault tokens create`
 *
 * Token storage:
 *   ~/.parachute/claw/paraclaw.db, table `vault_oauth_clients`:
 *     vault_origin TEXT, client_id TEXT, access_token TEXT, refresh_token TEXT
 *
 * Replace this file with the real implementation when Phase B starts. Keep
 * the public surface minimal (registerClient, beginAuthorize, completeCallback,
 * mintAgentToken) so the route handlers can wrap this without leaking detail.
 */

export interface VaultOAuthCoords {
  origin: string;
  clientId: string;
}

export class NotImplemented extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplemented";
  }
}

export async function registerClient(_vaultOrigin: string): Promise<VaultOAuthCoords> {
  throw new NotImplemented(
    "RFC 7591 DCR against vault — see docs/ui-design.md §OAuth flow.",
  );
}

export async function beginAuthorize(_coords: VaultOAuthCoords): Promise<URL> {
  throw new NotImplemented(
    "Build /oauth/authorize URL with PKCE challenge — see docs/architecture.md §B.2.",
  );
}

export async function completeCallback(
  _coords: VaultOAuthCoords,
  _code: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  throw new NotImplemented(
    "Exchange code for token at vault /oauth/token — see docs/architecture.md §B.2.",
  );
}

export async function mintAgentToken(
  _coords: VaultOAuthCoords,
  _adminToken: string,
  _scope: "vault:read" | "vault:write" | "vault:admin",
  _label: string,
): Promise<string> {
  throw new NotImplemented(
    "POST to vault token-mint endpoint with admin token — verify the API path exists or shell out to `parachute vault tokens create`.",
  );
}
