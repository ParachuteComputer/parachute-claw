/**
 * Vault HTTP client — for everything that isn't the OAuth handshake itself.
 * Phase B placeholder.
 *
 * Operations Paraclaw needs:
 *   - listNotes(pathPrefix) — find existing claws/* notes
 *   - readNote(path) — fetch an agent's identity note
 *   - upsertNote(path, content, metadata) — create / update agent identity
 *   - deleteNote(path) — when an agent is removed
 *   - mintToken(scope, label) — admin-only; the per-agent identity issuance
 *   - revokeToken(label) — kill switch
 *   - listTokens() — for the "Tokens & access" UI screen
 *
 * Auth: all calls carry the Paraclaw admin token (obtained via OAuth — see
 * oauth.ts). Per-agent tokens are minted by Paraclaw and handed to NanoClaw;
 * Paraclaw itself never uses per-agent tokens at runtime.
 *
 * Real implementation when Phase B starts. Keep this thin — the vault is
 * authoritative. Caching can come later if needed.
 */

import { NotImplemented } from "./oauth.ts";

export interface VaultClient {
  listClawNotes(): Promise<readonly { path: string; updatedAt: string }[]>;
  readNote(path: string): Promise<{ content: string; metadata: unknown } | null>;
  upsertNote(
    path: string,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  deleteNote(path: string): Promise<void>;
  mintToken(
    scope: "vault:read" | "vault:write" | "vault:admin",
    label: string,
  ): Promise<string>;
  revokeToken(label: string): Promise<void>;
  listTokens(): Promise<readonly { label: string; scope: string; createdAt: string }[]>;
}

export function createVaultClient(_vaultUrl: string, _adminToken: string): VaultClient {
  const stub: VaultClient = {
    listClawNotes: () => Promise.reject(new NotImplemented("vault.listClawNotes — Phase B")),
    readNote: () => Promise.reject(new NotImplemented("vault.readNote — Phase B")),
    upsertNote: () => Promise.reject(new NotImplemented("vault.upsertNote — Phase B")),
    deleteNote: () => Promise.reject(new NotImplemented("vault.deleteNote — Phase B")),
    mintToken: () => Promise.reject(new NotImplemented("vault.mintToken — Phase B")),
    revokeToken: () => Promise.reject(new NotImplemented("vault.revokeToken — Phase B")),
    listTokens: () => Promise.reject(new NotImplemented("vault.listTokens — Phase B")),
  };
  return stub;
}
