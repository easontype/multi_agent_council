/** @jsx React.createElement */
/* global React, CouncilIcon */

// ------- Agent card (setup panel) -------
window.AgentCard = function AgentCard({ agent, active = true, seatIndex }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid " + (active ? "#ececf1" : "#f0f0f2"),
      borderRadius: 14,
      overflow: "hidden",
      opacity: active ? 1 : 0.6,
      boxShadow: active ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
      transition: "box-shadow 200ms ease",
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}66)` }} />
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: agent.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            font: "700 12px Georgia, serif",
            boxShadow: `0 8px 18px ${agent.color}2c`,
          }}>{agent.initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#18181b", letterSpacing: "-0.005em" }}>{agent.name}</div>
            <div style={{ fontSize: 10.5, color: "#a1a1aa", marginTop: 1 }}>Seat {seatIndex} · {agent.role}</div>
          </div>
          <button className="btn-ghost" style={{ padding: "3px 10px", fontSize: 10.5, borderRadius: 999 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CouncilIcon name="edit" size={9} />Edit
            </span>
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {agent.focus.map((f) => (
            <span key={f} style={{
              background: agent.color + "0f",
              border: `1px solid ${agent.color}33`,
              color: agent.color,
              fontSize: 10, fontWeight: 600,
              letterSpacing: "0.03em",
              padding: "2px 8px",
              borderRadius: 999,
            }}>{f}</span>
          ))}
        </div>

        <div style={{
          background: "#fbfbfc",
          border: "1px solid #f0f0f2",
          borderRadius: 8,
          padding: "9px 11px",
          fontSize: 11.5,
          color: "#52525b",
          lineHeight: 1.55,
        }}>{agent.blurb}</div>
      </div>
    </div>
  );
};

// ------- Review setup panel (right rail, pre-start) -------
window.SetupPanel = function SetupPanel({ agents, onStart, mode, setMode, rounds, setRounds }) {
  return (
    <div style={{
      background: "#fafafa",
      border: "1px solid #ececf1",
      borderRadius: 14,
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid #f0f0f2",
        background: "rgba(255,255,255,0.7)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span className="micro">Review Setup</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#a1a1aa" }}>~ $0.08 – $0.15</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 0" }}>
        {/* Mode */}
        <div style={{ marginBottom: 16 }}>
          <div className="micro" style={{ marginBottom: 8 }}>Mode</div>
          <div style={{ display: "inline-flex", background: "#f0f0f2", borderRadius: 10, padding: 3, gap: 2, width: "100%" }}>
            <button onClick={() => setMode("debate")} style={{
              flex: 1,
              background: mode === "debate" ? "#111827" : "transparent",
              color: mode === "debate" ? "#fff" : "#71717a",
              border: "none", borderRadius: 8, padding: "6px 10px",
              font: (mode === "debate" ? 600 : 500) + " 12px inherit",
              cursor: "pointer",
            }}>Debate</button>
            <button onClick={() => setMode("compare")} style={{
              flex: 1,
              background: mode === "compare" ? "#111827" : "transparent",
              color: mode === "compare" ? "#fff" : "#71717a",
              border: "none", borderRadius: 8, padding: "6px 10px",
              font: (mode === "compare" ? 600 : 500) + " 12px inherit",
              cursor: "pointer",
            }}>Compare</button>
          </div>
          <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 8, lineHeight: 1.55 }}>
            {mode === "debate"
              ? "Reviewers speak in turn, with optional cross-examination between rounds."
              : "Reviewers answer a fixed set of dimensions independently — then view side-by-side."}
          </div>
        </div>

        {/* Rounds */}
        <div style={{ marginBottom: 16 }}>
          <div className="micro" style={{ marginBottom: 8 }}>Rounds</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3].map((r) => (
              <button key={r} onClick={() => setRounds(r)} style={{
                flex: 1,
                background: rounds === r ? "#fff" : "transparent",
                color: rounds === r ? "#18181b" : "#71717a",
                border: `1px solid ${rounds === r ? "#18181b" : "#e4e4e7"}`,
                borderRadius: 8, padding: "8px 10px",
                font: (rounds === r ? 600 : 500) + " 12.5px inherit",
                cursor: "pointer",
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* Panel */}
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="micro">Panel</span>
          <span style={{ fontSize: 11, color: "#71717a" }}>{agents.length} seats</span>
          <button className="btn-ghost" style={{ marginLeft: "auto", padding: "3px 10px", fontSize: 11 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CouncilIcon name="users" size={10} />Build Team
            </span>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agents.map((a, i) => (
            <AgentCard key={a.id} agent={a} seatIndex={i + 1} />
          ))}
          <button style={{
            background: "transparent",
            border: "1px dashed #c7c7cf",
            borderRadius: 10,
            padding: "12px 14px",
            font: "500 12px inherit",
            color: "#71717a",
            cursor: "pointer",
          }}>+ Add Manual Seat</button>
        </div>
      </div>

      {/* Start button pinned */}
      <div style={{
        padding: "14px 18px",
        borderTop: "1px solid #f0f0f2",
        background: "rgba(255,255,255,0.7)",
      }}>
        <button onClick={onStart} className="btn-primary" style={{ width: "100%" }}>
          Start Review
        </button>
        <div style={{ fontSize: 10.5, color: "#a1a1aa", marginTop: 6, textAlign: "center", letterSpacing: 0.2 }}>
          {agents.length} reviewers · {rounds} {rounds === 1 ? "round" : "rounds"} · approx. 90 sec
        </div>
      </div>
    </div>
  );
};
