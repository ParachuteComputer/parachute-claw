import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAgents, type AgentSummary } from "../lib/server.ts";

export function AgentList() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; agents: AgentSummary[] }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchAgents()
      .then((agents) => !cancelled && setState({ kind: "ok", agents }))
      .catch(
        (err) =>
          !cancelled &&
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="status-banner">Loading agents from your vault…</div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <div className="error-banner">
          Couldn't reach Paraclaw server: <code>{state.message}</code>
        </div>
        <p className="muted">
          Make sure the server is running:{" "}
          <code>cd server && bun src/server.ts</code>. It needs{" "}
          <code>PARACLAW_VAULT_TOKEN</code> set to a vault admin token.
        </p>
      </div>
    );
  }

  if (state.agents.length === 0) {
    return (
      <div className="empty">
        <p>No claws yet.</p>
        <p>
          <Link to="/agents/new">Create your first one →</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Your claws ({state.agents.length})</h2>
      {state.agents.map((a) => (
        <Link key={a.name} to={`/agents/${a.name}`} className="agent-row">
          <div className="name">
            {a.name}
            {a.paused && <span className="tag muted">paused</span>}
            {a.inboxPending > 0 && (
              <span className="tag">
                {a.inboxPending} pending
              </span>
            )}
            {a.lastRun?.status === "error" && (
              <span className="tag error">last run errored</span>
            )}
          </div>
          <div className="meta">
            {a.scopes.length > 0 && (
              <>scopes: {a.scopes.join(", ")} · </>
            )}
            {a.channels.length > 0 ? (
              <>channels: {a.channels.join(", ")}</>
            ) : (
              <>no channels yet</>
            )}
            {a.lastRun?.finishedAt && (
              <> · last active {new Date(a.lastRun.finishedAt).toLocaleString()}</>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
