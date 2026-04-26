import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchAgent,
  fetchRuns,
  sendMessage,
  type AgentSummary,
  type RunSummary,
} from "../lib/server.ts";

export function AgentDetail() {
  const { name } = useParams<{ name: string }>();
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Compose form state.
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!name) return;
    try {
      setLoading(true);
      const [a, r] = await Promise.all([fetchAgent(name), fetchRuns(name)]);
      setAgent(a);
      setRuns(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !composeText.trim()) return;
    setSending(true);
    setSendStatus(null);
    try {
      const result = await sendMessage(name, composeText.trim(), "ui");
      setSendStatus(`Queued: ${result.path}. Runtime will pick it up.`);
      setComposeText("");
      // Re-poll runs after a short delay so the result might be visible.
      setTimeout(() => void reload(), 3000);
    } catch (err) {
      setSendStatus(`Send failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  if (loading && !agent) {
    return <div className="status-banner">Loading {name}…</div>;
  }

  if (error) {
    return (
      <div>
        <Link to="/" className="muted">
          ← All agents
        </Link>
        <div className="error-banner" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div>
        <Link to="/" className="muted">← All agents</Link>
        <div className="empty">Agent not found.</div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/" className="muted">← All agents</Link>
      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {agent.name}
        {agent.paused && <span className="tag muted">paused</span>}
      </h2>

      <div className="section">
        <h3>Identity (vault note)</h3>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>
          {agent.identity.content}
        </pre>
        <hr className="sep" />
        <div className="dim">
          Path: <code>claws/{agent.name}</code>
          {" · "}
          Edit in Notes (or via <code>update-note</code> from any MCP client) to
          change this agent's persona.
        </div>
      </div>

      <div className="section">
        <h3>Access</h3>
        <div className="muted">
          Scopes:{" "}
          {agent.scopes.length > 0 ? (
            agent.scopes.map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))
          ) : (
            <em>none yet</em>
          )}
        </div>
        <div className="muted" style={{ marginTop: "0.5rem" }}>
          Channels:{" "}
          {agent.channels.length > 0 ? (
            agent.channels.map((c) => (
              <span className="tag" key={c}>
                {c}
              </span>
            ))
          ) : (
            <em>no channels wired yet (Phase B)</em>
          )}
        </div>
      </div>

      <div className="section">
        <h3>Send a test message</h3>
        <form onSubmit={onSend}>
          <div className="row">
            <textarea
              placeholder="Type a message to this claw — it lands in claws/<name>/inbox/ and the runtime picks it up."
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              disabled={sending}
            />
          </div>
          <button type="submit" disabled={sending || !composeText.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
          {sendStatus && (
            <p className="dim" style={{ marginTop: "0.75rem" }}>
              {sendStatus}
            </p>
          )}
        </form>
      </div>

      <div className="section">
        <h3>Recent runs ({runs.length})</h3>
        {runs.length === 0 ? (
          <div className="dim">
            No runs yet. Send a message above (and make sure the runtime is running:{" "}
            <code>cd runtime && bun src/cli.ts run {agent.name}</code>).
          </div>
        ) : (
          runs.slice(0, 20).map((r) => (
            <div key={r.runId} className="run-row">
              <div>
                <span className={r.status === "ok" ? "tag" : "tag error"}>
                  {r.status}
                </span>
                <span className="tag muted">{r.source}</span>
                {r.runId && <span className="when"> · run {r.runId.slice(0, 8)}</span>}
                {r.finishedAt && (
                  <span className="when">
                    {" "}
                    · {new Date(r.finishedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="summary">{r.summary}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
