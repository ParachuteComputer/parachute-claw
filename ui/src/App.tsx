import { Link, Route, Routes } from "react-router-dom";
import { AgentList } from "./routes/AgentList.tsx";
import { AgentDetail } from "./routes/AgentDetail.tsx";
import { NewAgent } from "./routes/NewAgent.tsx";

const styles = `
  :root {
    --bg: #faf8f4;
    --bg-soft: #f3f0ea;
    --fg: #2c2a26;
    --fg-muted: #6b6860;
    --fg-dim: #9a9690;
    --accent: #4a7c59;
    --border: #e6e1d8;
  }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .page { max-width: 880px; margin: 0 auto; padding: 1.5rem; }
  .nav { display: flex; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
  .nav a { color: var(--accent); text-decoration: none; font-weight: 500; }
  .skeleton-banner {
    border: 1px solid var(--border);
    background: var(--bg-soft);
    padding: 1rem;
    border-radius: 8px;
    color: var(--fg-muted);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }
`;

export function App() {
  return (
    <>
      <style>{styles}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/">Agents</Link>
          <Link to="/agents/new">+ New agent</Link>
        </nav>
        <div className="skeleton-banner">
          <strong>Phase B scaffold.</strong> The UI is a placeholder; real
          rendering wires up once the server has data behind it. See{" "}
          <a
            href="https://github.com/ParachuteComputer/parachute-claw/blob/main/docs/ui-design.md"
            target="_blank"
            rel="noreferrer"
          >
            docs/ui-design.md
          </a>{" "}
          for the full design.
        </div>
        <Routes>
          <Route path="/" element={<AgentList />} />
          <Route path="/agents/new" element={<NewAgent />} />
          <Route path="/agents/:name" element={<AgentDetail />} />
          <Route path="*" element={<div>404 — try the Agents tab.</div>} />
        </Routes>
      </div>
    </>
  );
}
