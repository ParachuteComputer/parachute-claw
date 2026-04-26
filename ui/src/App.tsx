import { NavLink, Route, Routes } from "react-router-dom";
import { AgentList } from "./routes/AgentList.tsx";
import { AgentDetail } from "./routes/AgentDetail.tsx";
import { NewAgent } from "./routes/NewAgent.tsx";

export function App() {
  return (
    <div className="page">
      <nav className="nav">
        <span className="brand">Paraclaw</span>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Agents
        </NavLink>
        <NavLink
          to="/agents/new"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          + New
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<AgentList />} />
        <Route path="/agents/new" element={<NewAgent />} />
        <Route path="/agents/:name" element={<AgentDetail />} />
        <Route path="*" element={<div className="empty">404 — try Agents.</div>} />
      </Routes>
    </div>
  );
}
