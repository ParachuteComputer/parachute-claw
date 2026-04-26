# CLAUDE.md — parachute-claw

Parachute-native agent framework. NanoClaw skill today, Parachute distribution tomorrow.

> **Pre-RC.** Branch protection is off; direct push to `main` is fine while shape is fluid. Once we hit RC and publish, governance kicks in: PR-required, RC versioning, patterns check. Track that transition in the top-level README's "Status" section.

## Layout

```
parachute-claw/
├── README.md                 — top-level vision, install, status
├── CLAUDE.md                 — this file (per-repo conventions)
├── LICENSE                   — AGPL-3.0
├── docs/                     — design docs and architecture
│   ├── architecture.md       — Phase A → B → C trajectory
│   ├── phase-a-skill.md      — the NanoClaw skill (today)
│   ├── phase-b-vision.md     — the Parachute distribution (next)
│   └── ui-design.md          — web-UI architecture sketch
├── skill/                    — Phase A: NanoClaw skill installer
│   ├── README.md             — what the skill does, install path
│   └── add-parachute.md      — the actual skill (Claude-Code-driven shape)
└── (ui/, server/ deferred to Phase B)
```

## Phase A is the contract today

The skill in `skill/` is what users install into their NanoClaw fork. It must:

- **Be readable end-to-end by Claude Code.** Single page if possible.
- **Auto-mint scoped tokens via `parachute vault tokens create`** rather than asking the user to paste them in plain text.
- **Be reversible.** If the user wants to remove the integration, the skill should say how. Reversible install is part of the contract.
- **Not modify NanoClaw upstream.** Stays in the user's fork as a skill, never patches the upstream `qwibitai/nanoclaw` source. If the integration ever needs upstream changes, those go through NanoClaw's own PR process.

## Phase B will introduce code surfaces

When `ui/` and `server/` land:

- **`server/`** is a Bun + SQLite service following the same `parachute-vault` shape. Listens on a canonical port (claim a slot when it ships per `parachute-patterns/patterns/canonical-ports.md` — *don't* pre-reserve before code exists).
- **`ui/`** is a Vite + React + TypeScript PWA following the `parachute-notes` shape. Talks to `server/` over HTTP; speaks vault directly via the user's OAuth-issued token.
- **OAuth flow** uses the existing vault OAuth endpoints (per `parachute-vault/docs/auth-model.md`) — Paraclaw is just an OAuth client of the user's vault.

Phase B starts when the Phase A skill has real users and we have empirical data on what they want to do that the chat-with-Claude-Code path doesn't already give them.

## Conventions

- **Bun-native** for any code that ships. `bun:sqlite`, `Bun.serve`, `Bun.spawn`. No Node.
- **Tests in `bun test`** when there's code to test. Phase A is mostly markdown; Phase B will have plenty.
- **Versioning per the ecosystem `governance.md`** — pre-1.0 RC pattern, `npm publish --tag rc` on merge, `dist-tag add latest` on validation.
- **Cross-cutting conventions** live in [`parachute-patterns`](../parachute-patterns) — module protocol, ports, OAuth scopes, governance. Conform; if a convention is wrong, propose a change there first.
- **Patterns adoption** of "CLI as port authority" — when Phase B server lands, it should claim its port via `parachute-cli` rather than hard-coding a slot.

## Working conventions

- Pre-RC: direct push to `main` is fine for scaffolding. Feature branches once we have multiple contributors or hit RC.
- WHY-focused commit messages. The README and design docs are the durable communication; commit messages capture per-change context.
- Attribution on every commit: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Post-merge hygiene

Once branch protection is on (post-RC):

```sh
git checkout main && git pull
```

Same convention as the rest of the Parachute ecosystem. Until then, no merges to chase.
