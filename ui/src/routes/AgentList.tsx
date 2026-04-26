import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAgents } from "../lib/server.ts";

interface AgentRow {
  name: string;
  scope: string;
  channels: string[];
  lastActivityAt?: string;
  paused: boolean;
}

export function AgentList() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; agents: AgentRow[] }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchAgents()
      .then((agents) => !cancelled && setState({ kind: "ok", agents }))
      .catch((err) =>
        !cancelled &&
        setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") return <div>Loading agents...</div>;

  if (state.kind === "error") {
    return (
      <div>
        <h2>Agents</h2>
        <p style={{ color: "var(--fg-muted)" }}>
          Server returned: <code>{state.message}</code>
        </p>
        <p style={{ color: "var(--fg-dim)", fontSize: "0.85rem" }}>
          Expected today — server's <code>/api/agents</code> is a 501 stub.
          Real listing wires up in Phase B (see{" "}
          <code>docs/ui-design.md</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Agents</h2>
      {state.agents.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>
          No agents yet. <Link to="/agents/new">Create one →</Link>
        </p>
      ) : (
        <ul>
          {state.agents.map((a) => (
            <li key={a.name}>
              <Link to={`/agents/${a.name}`}>
                {a.name}
              </Link>
              <span style={{ color: "var(--fg-muted)", marginLeft: "0.5rem" }}>
                ({a.scope}, {a.channels.join(" / ") || "no channels"})
              </span>
              {a.paused && <em> · paused</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
