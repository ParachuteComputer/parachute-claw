import { Link, useParams } from "react-router-dom";

export function AgentDetail() {
  const { name } = useParams<{ name: string }>();

  return (
    <div>
      <Link to="/" style={{ color: "var(--fg-muted)" }}>
        ← All agents
      </Link>
      <h2>{name}</h2>
      <p style={{ color: "var(--fg-muted)" }}>
        Phase B placeholder. The full agent-detail screen — identity (vault
        note), access (token / scope / rotation), channels, schedules, recent
        activity — is sketched in{" "}
        <a
          href="https://github.com/ParachuteComputer/parachute-claw/blob/main/docs/ui-design.md#screen-2--agent-detail"
          target="_blank"
          rel="noreferrer"
        >
          docs/ui-design.md §Screen 2
        </a>
        .
      </p>
      <p style={{ color: "var(--fg-dim)", fontSize: "0.85rem" }}>
        Wires up once the server has data behind it.
      </p>
    </div>
  );
}
