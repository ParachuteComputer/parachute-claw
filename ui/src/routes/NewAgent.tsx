import { Link } from "react-router-dom";

export function NewAgent() {
  return (
    <div>
      <Link to="/" style={{ color: "var(--fg-muted)" }}>
        ← All agents
      </Link>
      <h2>New agent</h2>
      <p style={{ color: "var(--fg-muted)" }}>
        Phase B placeholder. The five-step wizard — name, persona, scope,
        channels, schedules — is sketched in{" "}
        <a
          href="https://github.com/ParachuteComputer/parachute-claw/blob/main/docs/ui-design.md#screen-3--new-agent-wizard"
          target="_blank"
          rel="noreferrer"
        >
          docs/ui-design.md §Screen 3
        </a>
        .
      </p>
      <p style={{ color: "var(--fg-dim)", fontSize: "0.85rem" }}>
        Goal: agent answering Telegram messages in under 60 seconds, no
        terminal.
      </p>
    </div>
  );
}
