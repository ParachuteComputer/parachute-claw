import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAgent } from "../lib/server.ts";

const SCOPE_OPTIONS = [
  { value: "vault:read", label: "vault:read — agent can query, can't modify" },
  { value: "vault:write", label: "vault:write — agent can capture and update notes" },
  { value: "vault:admin", label: "vault:admin — full vault access (use sparingly)" },
];

const TEMPLATES = [
  { id: "blank", label: "Blank — write your own", text: "" },
  {
    id: "researcher",
    label: "Research assistant — queries vault, summarizes, never writes",
    text:
      "You are a research assistant. When asked a question, query the vault for relevant notes, synthesize what you find, and respond with a concise summary. Cite the note paths you used. Never create, update, or delete notes — your job is to surface what's there.",
  },
  {
    id: "scribe",
    label: "Personal scribe — captures notes from messages",
    text:
      "You are my personal scribe. When I send you something, decide whether it's worth capturing in my vault as a note. If yes, create a note with appropriate tags and a clear path. If not, acknowledge briefly. Tags I commonly use: #idea, #todo, #journal, #people. When unsure, ask me.",
  },
  {
    id: "morning-brief",
    label: "Morning brief — daily summarizer",
    text:
      "You are my morning briefing agent. Each time you're invoked, query the vault for notes I've created in the last 24 hours, group them by tag, and produce a tight 5-bullet summary of what I was thinking about. Avoid filler. Just the bullets.",
  },
];

export function NewAgent() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("blank");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [scope, setScope] = useState("vault:read");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) setSystemPrompt(t.text);
  };

  const validateName = (s: string) => /^[a-z0-9][a-z0-9-_]{0,40}$/.test(s);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateName(name)) {
      setError("name must be lowercase alphanumeric with hyphens or underscores (1–40 chars).");
      return;
    }
    if (!systemPrompt.trim()) {
      setError("systemPrompt is required — describe what this claw is for.");
      return;
    }
    setSubmitting(true);
    try {
      await createAgent({
        name,
        systemPrompt: systemPrompt.trim(),
        scopes: [scope],
        channels: [],
      });
      nav(`/agents/${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link to="/" className="muted">← All agents</Link>
      <h2>New claw</h2>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={onSubmit} className="section">
        <div className="row">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="research-bot"
            disabled={submitting}
          />
          <p className="dim">
            Lives at <code>claws/{name || "<name>"}</code> in your vault. The
            note IS the agent's identity.
          </p>
        </div>

        <div className="row">
          <label htmlFor="template">Template</label>
          <select
            id="template"
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={submitting}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="row">
          <label htmlFor="prompt">Persona / system prompt</label>
          <textarea
            id="prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={submitting}
            placeholder="Describe what this claw does, when to act, what tone to use…"
          />
        </div>

        <div className="row">
          <label htmlFor="scope">Vault scope</label>
          <select
            id="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={submitting}
          >
            {SCOPE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <p className="dim">
            v1: scope is recorded on the identity note. Phase B mints a
            corresponding scoped vault token automatically.
          </p>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create claw"}
        </button>
      </form>

      <div className="section">
        <h3>What happens next</h3>
        <ol className="muted" style={{ paddingLeft: "1.2rem" }}>
          <li>
            A vault note is created at <code>claws/{name || "<name>"}</code>.
            Frontmatter records the chosen scope.
          </li>
          <li>
            You can start the runtime: <code>bun runtime/src/cli.ts run {name || "<name>"} --vault-token pvt_…</code>
          </li>
          <li>
            Send a test message from the agent's detail page. The runtime
            picks it up and responds.
          </li>
        </ol>
      </div>
    </div>
  );
}
