#!/usr/bin/env bun
/**
 * Paraclaw runtime CLI.
 *
 * Usage:
 *   paraclaw-runtime run <agent-name> [--vault-url URL] [--vault-token TOK]
 *                                     [--once] [--poll-ms 5000]
 *
 * Or via env: PARACLAW_VAULT_URL, PARACLAW_VAULT_TOKEN.
 */
import { runAgent } from "./runtime.ts";

function arg(name: string, args: string[]): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function bool(name: string, args: string[]): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  const [, , subcommand, ...rest] = process.argv;

  if (subcommand !== "run" || rest.length === 0) {
    console.error("usage: paraclaw-runtime run <agent-name> [--vault-url URL] [--vault-token TOK] [--once] [--poll-ms 5000]");
    process.exit(2);
  }

  const agentName = rest[0];
  const vaultBaseUrl =
    arg("vault-url", rest) ??
    process.env.PARACLAW_VAULT_URL ??
    "http://127.0.0.1:1940/vault/default";
  const vaultToken = arg("vault-token", rest) ?? process.env.PARACLAW_VAULT_TOKEN;
  const oneShot = bool("once", rest);
  const pollMs = arg("poll-ms", rest) ? Number(arg("poll-ms", rest)) : 5000;

  if (!vaultToken) {
    console.error("missing vault token: pass --vault-token or set PARACLAW_VAULT_TOKEN");
    process.exit(2);
  }

  console.log(`paraclaw runtime — agent: ${agentName}, vault: ${vaultBaseUrl}`);

  try {
    await runAgent({
      agentName,
      vaultBaseUrl,
      vaultToken,
      oneShot,
      pollMs,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
