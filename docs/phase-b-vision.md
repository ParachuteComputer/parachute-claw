# Phase B Vision — Paraclaw the distribution

> Architecture doc covers Phase B as one stage in the trajectory. This doc goes deeper into the design space — what Paraclaw could become if Phase B lands well, and the choices we have along the way.

## The framing

Phase A is composition: a skill that wires Parachute Vault into NanoClaw. Phase B is **identity**: Paraclaw becomes the place where users decide what agents they have, what those agents can do, and how those agents interact with their vault. Phase A's value scales with how many NanoClaw users want vault integration. Phase B's value scales with how many *Parachute users* want agents at all.

Those are different audiences. Phase A serves NanoClaw natives. Phase B serves the broader Parachute community — including people who'd never have installed NanoClaw on their own but who'll happily install Paraclaw when it's framed as "the Parachute way to run agents."

This is the inversion that makes Phase B worth shipping.

## What "Paraclaw the distribution" actually means

A Parachute-flavored fork or distribution of NanoClaw is a real choice with multiple viable shapes:

### Shape 1 — Distribution as a wrapper

Paraclaw doesn't fork NanoClaw. It depends on it as an upstream. A user who installs Paraclaw gets:
- NanoClaw, installed as a dependency at a pinned version
- The Phase A skill, pre-installed
- The Paraclaw web UI + server, layered on top
- Branding, docs, install scripts that paper over the NanoClaw seams

Updates flow: NanoClaw upstream releases → we test → bump our pin → release. Easy maintenance, but changes to NanoClaw can break our UI's assumptions about its SQLite layout.

### Shape 2 — Distribution as a soft fork

Paraclaw is a fork of NanoClaw with our additions in `paraclaw/` and our changes to NanoClaw kept minimal. We rebase against upstream periodically.

We'd diverge on:
- Default channel set (Parachute users probably want different defaults than NanoClaw's)
- Default agent CLAUDE.md template (one that knows about the vault)
- Service discovery (Paraclaw services register with the local Parachute hub at `:1939`)
- OAuth integration (Paraclaw is the OAuth client of vault — NanoClaw upstream doesn't know about this)

We'd keep upstream's:
- Container model
- Message queue I/O
- Channel adapter base
- Claude Agent SDK runtime

This is the path I'd recommend if Shape 1 proves too brittle on the SQLite-bridge.

### Shape 3 — Hard fork

Paraclaw becomes its own thing, deeply integrating with vault as the substrate (instead of NanoClaw's SQLite). Agents' messages flow into vault notes directly. Schedules are vault-trigger-based. The container model stays but everything else is reimagined.

Highest cost, most opinionated, and only worth it if Shape 1 and Shape 2 both fail to express what Parachute users actually want.

**Default to Shape 1 until the data forces us up.** Phase B starts as a wrapper.

## Vault as the substrate

The deepest version of Paraclaw treats the vault as the agent's filesystem.

**What's in the vault:**
- `claws/<name>` — agent identity (CLAUDE.md as content; channels/schedules/scopes as frontmatter)
- `claws/<name>/messages/<timestamp>.<channel>` — every message the agent sent, attachment included if any
- `claws/<name>/queries/<timestamp>` — every vault query the agent made and what it learned
- `claws/<name>/runs/<timestamp>` — scheduled-job runs, their inputs, their outputs
- `claws/<name>/credentials` — token labels and scopes (NOT the raw tokens; those live in NanoClaw's credential store)

**Why?** Because the user's vault is already the place they think with. If their agent's whole working memory is in the vault, they can:
- Query what their agent did last Thursday (`query-notes path-prefix=claws/personal-assistant/runs --since 2026-04-21`)
- Have one agent read another agent's work (`query-notes path-prefix=claws/research-bot --tag #berlin`)
- Onboard a new agent by pointing it at an existing agent's note tree as its starting context
- Search across all agents and all conversations as one graph

This is the asymmetry. Other agent frameworks have to invent their own memory layer (and many of them do — JSON blobs in a SQLite, vector stores, separate databases). Paraclaw inherits one for free, and one that the user is already using and trusts.

**What this means for Phase B sequencing:** the early Phase B can use NanoClaw's existing SQLite for runtime queues and *only* use vault for agent identity (the `claws/<name>` note). The deeper version copies all message/query/run history into the vault as it happens. The deepest version makes vault the only store, with NanoClaw's SQLite as a write-through cache. We get to that gradually, validating each step with users.

## The OAuth flow as a recruitment tool

Phase B's OAuth flow is interesting beyond just authentication. When a user logs into Paraclaw via vault OAuth, they're being asked to consent to "Paraclaw can manage tokens for your vault."

But the *content* of that consent page is a teaching moment. It explains what Paraclaw will do — mint per-agent tokens, with whatever scopes the user picks — and lets them see the trust model before they commit. Users who've never thought about agent identity get a one-page primer.

This is the kind of UX where the mechanism *is* the explanation. Compare to "paste this API key in two places" (no education, just friction) or "trust this agent with your account" (education but no granularity). Paraclaw's OAuth flow does both: it informs the user *and* gives them the granular tools to act on the information.

## The "kill switch" UX

The single most important UI element in Paraclaw is the revoke button.

When a user thinks "I want to stop this agent right now," they should:
1. Open Paraclaw.
2. See a list of agents, each with a clear status indicator.
3. Click the agent.
4. Click "Revoke token" (or "Pause agent" — softer; or "Delete agent" — total).

That's it. Three clicks from "I want this stopped" to "it's stopped."

The revoke button doesn't just disable Paraclaw's view of the agent. It revokes the vault token, which means the agent's container — even if NanoClaw is somehow misbehaving — physically can't talk to the vault anymore. Defense in depth: even if the framework fails, the auth layer holds.

This kind of clarity around capability and revocation is what makes "let an agent answer my Telegram on my behalf" actually palatable to non-technical users. Most people won't try this without confidence in their ability to undo it.

## Channels and the messaging surface area

NanoClaw ships with a wide range of channel adapters (WhatsApp / Telegram / Discord / Slack / iMessage / Matrix / Teams / Linear / GitHub / etc.). Paraclaw doesn't need to ship them all on day one.

**Reasonable Phase B subset (in priority order):**
- **Telegram** — real users in Aaron's network use it; bot setup is well-documented; OAuth-free.
- **Discord** — same as above for a different community.
- **iMessage** — high-value but tricky (BlueBubbles or similar); macOS-only; ship behind a "advanced" flag.
- **Slack** — corporate/team use; OAuth-flow heavier.
- **Email (Gmail via Resend)** — universal but spammy; lower priority.

**Out of scope for Phase B:** WhatsApp (requires Business API), Matrix (smaller user base), Teams (corporate-only).

The Paraclaw UI shows all NanoClaw-supported channels; Paraclaw's *defaults* are the priority subset above. Users can add others via NanoClaw's `/add-<channel>` flow.

## Scheduled jobs as cron-with-context

NanoClaw has scheduled jobs as a primitive. Paraclaw's Phase B UI surfaces them — but the design space here is interesting because vault gives us context that pure cron doesn't have.

**Examples of Paraclaw schedule shapes that other frameworks can't easily express:**

- "Every weekday at 7:30am, summarize new vault notes tagged `#work` from the last 24h, post to Telegram."
- "When I create a note tagged `#brief`, kick off the briefing agent within 10 minutes."
- "Every Friday at 5pm, query the vault for notes tagged `#weekly-review`, ask me follow-up questions in iMessage, capture my answers as new notes."

The first is straight cron + content. The second is **vault-triggered** scheduling: a webhook from vault's existing trigger system fires Paraclaw's scheduler, which spins up the agent on demand. The third is **conversational scheduling**: the agent isn't just executing a task, it's running a recurring dialogue.

These are emergent from the composition. Any single piece — vault triggers, agent runtime, scheduler, channels — exists today. Paraclaw's UI is what makes them combinable by people who don't write code.

## Multi-vault is the Phase C precondition for...

Once the vault ships per-vault-name scopes (`vault:work:read` vs `vault:personal:read`), Paraclaw's Phase B+ can support agents that hold tokens for multiple vaults. The implications:

- **Privacy by construction.** A "work assistant" agent gets `vault:work:write` only. It physically cannot read your personal vault. Even if the agent goes haywire or is prompt-injected, the worst it can do is the work scope.
- **Per-context behavior.** "When I message you in Slack, only ever query the work vault. When I message you in iMessage, only ever query the personal vault." Configurable per agent per channel.
- **Cross-vault delegation** (Phase C): a personal-assistant agent that, when asked something work-shaped, delegates to a work-scoped sub-agent. The sub-agent operates with a narrower token; on completion, returns just the answer (not the work-vault context).

This is the kind of model that doesn't exist anywhere else right now. It exists in Parachute because of the foundation work that's already shipped. Paraclaw's Phase B+ is the visible expression of that foundation.

## The "spinning up an agent in 60 seconds" promise

Phase B's success criterion: a Parachute user, fresh install of Paraclaw, can have a working agent answering Telegram messages in under 60 seconds, without ever opening a terminal after the initial install.

What this requires in the UX:

1. Click "+ New agent."
2. Fill the wizard (name, persona, scope, channel, optional schedule).
3. Click "Create."
4. Watch the loading state for ~10 seconds (token minted, vault note created, container spun up, channel auth completed, smoke test).
5. Done state shows: "Send a message to @<bot> in Telegram to test."

If this promise lands, Paraclaw is genuinely something nobody else has shipped. Every other agent framework requires either (a) a terminal, (b) a config file, or (c) a marketplace where you pick from someone else's recipe. Paraclaw's promise is "your own agent, your own scope, your own vault, in under a minute, in a browser."

This is the design constraint that should drive every UI decision.

## Risks and mitigations

**Risk: NanoClaw upstream evolves in ways that break our SQLite bridge.**
Mitigation: write the bridge as a contract (TypeScript interface), test against pinned NanoClaw versions in CI, file issues upstream when contract drift bites. If volatility is too high, escalate to Shape 2 (soft fork).

**Risk: The "vault as substrate" promise is too aspirational and we get bogged down in the vault note schema design.**
Mitigation: ship Phase B with vault-as-identity-only first. Don't try to land the full vault-as-substrate before Phase B has real users. Vault-as-substrate is a Phase B.5 / C goal.

**Risk: The OAuth flow's "consent for `vault:admin`" is scary to users.**
Mitigation: the consent page (vault's, not Paraclaw's) needs to explain *why* admin scope is needed (token minting) and what Paraclaw cannot do (read your notes — Paraclaw mints tokens but never queries vault content for itself). This is a copy + UX issue, but it's the user's first interaction; nail it.

**Risk: Mobile UX is a poor fit for the management surface.**
Mitigation: Phase B mobile is "view + pause/resume." Full create/edit is desktop. Same posture as Notes today; users are used to it.

**Risk: Paraclaw becomes a maintenance burden equal to or larger than vault.**
Mitigation: keep Paraclaw small. The whole point is composition. Server is < 2k LOC; UI is mostly form-state and lists. If we find ourselves writing more, ask whether the work belongs in vault, the CLI, or upstream NanoClaw instead.

## What we should learn from Phase 0 before committing to Phase B

Before sinking weeks into the server + UI:
- Does the Phase A skill actually feel good to use? Does the user think "ah, my agent has my vault now"?
- Is NanoClaw's SQLite layout stable enough to read from over a multi-version window?
- What channels do real users (Aaron + a small beta cohort) actually want to install? If it's just Telegram + iMessage, Phase B's channel UX can be much simpler than "support every channel NanoClaw supports."
- What does "scheduled job" mean to a non-technical user? Is the cron-style mental model right, or do we need natural-language scheduling ("every weekday morning")?

Each of these moves the Phase B design. We should not start writing the server until at least Phase A has 5 real users.

## Naming, brand, positioning

- **Paraclaw** — the project. Short, distinct, doesn't pretend to be NanoClaw.
- **A claw** — an individual agent in Paraclaw. Plays well with the Claw-family naming.
- **The claw shop** — the hypothetical marketplace where users can share/import agent recipes. Phase C; the marketplace would be a Parachute-native distribution of CLAUDE.md templates + suggested scopes + suggested schedules. Each "recipe" is a vault note with a specific structure; importing it means cloning the note into your vault and adjusting.

## Open design space (things we didn't pick yet)

- **Single-agent vs multi-agent UX**: NanoClaw's `agent group` concept. Should Paraclaw expose that, or hide it behind a single-agent abstraction? Probably hide for v1; expose if real users hit "I need two agents in one container."
- **Voice as a first-class channel**: scribe is right there. Could a Paraclaw claw take voice input via Telegram voice messages, run scribe transcription via vault, and respond? Likely yes; surface it in the UI as a per-channel checkbox ("transcribe voice").
- **Agent introspection**: should each claw have a `/whoami` MCP tool that returns its own scopes/channels/schedules? Probably useful — agents can reason about their own capabilities.
- **Auditing**: should every action a claw takes (every vault write, every message sent) be logged separately for the user to review? Yes, but where — in vault as `claws/<name>/log`, in Paraclaw's SQLite, in NanoClaw's existing log? Worth deciding before the schema sets.

These are good Phase B design questions to leave open until empirical data forces a choice.
