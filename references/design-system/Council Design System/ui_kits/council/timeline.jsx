/** @jsx React.createElement */
/* global React, CouncilIcon */

const { useState: useTimelineState } = React;

// ------- Agent message bubble -------
window.AgentMessage = function AgentMessage({ agent, round, label, text, streaming, evidence }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${agent.color}08 0%, #fff 60%)`,
      borderLeft: `2px solid ${agent.color}`,
      borderTop: "1px solid #ececf1",
      borderRight: "1px solid #ececf1",
      borderBottom: "1px solid #ececf1",
      borderRadius: "0 12px 12px 0",
      padding: "14px 18px",
      animation: "msgin 220ms ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: agent.color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          font: "700 11px Georgia, serif",
        }}>{agent.initial}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#18181b" }}>{agent.name}</div>
        <div className="micro" style={{ letterSpacing: "0.07em" }}>Round {round} · {label}</div>
        {streaming && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", animation: "pulse 1.2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "#71717a", fontWeight: 500 }}>streaming</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 13.5, color: "#27272a", lineHeight: 1.75 }}>
        {text}
        {streaming && <span style={{ display: "inline-block", width: 2, height: 14, background: agent.color, marginLeft: 2, verticalAlign: -2, animation: "blink 0.8s steps(2) infinite" }} />}
      </div>
      {evidence && evidence.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {evidence.map((e, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#fff", border: "1px solid #ececf1", borderRadius: 999,
              padding: "2px 8px", fontSize: 10.5, color: "#52525b",
            }}>
              <span className="mono" style={{ fontSize: 9.5, color: "#a1a1aa" }}>{e.ref}</span> {e.label}
              {e.ext && <span style={{ color: "#a1a1aa", display: "inline-flex" }}><CouncilIcon name="ext" size={9} /></span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ------- Round divider -------
window.RoundDivider = function RoundDivider({ n, label }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "16px 0 10px" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#ccc", textTransform: "uppercase" }}>Round</span>
      <span style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 800, color: "#f0f0f2", letterSpacing: "-0.03em", lineHeight: 1 }}>{n}</span>
      <div style={{ flex: 1, height: 1, background: "#f0f0f2" }} />
      <span style={{ fontSize: 11, color: "#a1a1aa" }}>{label}</span>
    </div>
  );
};

// ------- Conclusion banner -------
window.ConclusionBanner = function ConclusionBanner({ n }) {
  return (
    <div style={{
      marginTop: 14,
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{ color: "#16a34a", display: "flex" }}><CouncilIcon name="check" size={16} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#15803d" }}>Panel discussion concluded</div>
        <div style={{ fontSize: 11.5, color: "#166534", marginTop: 1 }}>All {n} reviewers have submitted their assessments.</div>
      </div>
      <button className="btn-ghost" style={{ borderColor: "#bbf7d0", color: "#15803d" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CouncilIcon name="download" size={10} />Export markdown
        </span>
      </button>
    </div>
  );
};

// ------- Discussion timeline -------
window.DiscussionTimeline = function DiscussionTimeline({ agents }) {
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  const messages = [
    { r: 1, label: "opening", agent: "methods-critic", text: "The panel-size analysis in Table 3 conflates two effects: the number of reviewers and the total FLOPs spent. Without a FLOPs-matched baseline, the claim that five seats outperform three is under-determined.", ev: [{ ref: "§4.2", label: "Table 3", ext: true }, { ref: "eq. 7", label: "FLOPs def" }] },
    { r: 1, label: "opening", agent: "literature-auditor", text: "The related-work section attributes multi-agent debate to Du et al. (2023) but omits the closer precedent in Irving et al. (2018) \"AI safety via debate\". That omission weakens the novelty claim in §1.", ev: [{ ref: "ref 12", label: "Irving 2018", ext: true }] },
    { r: 1, label: "opening", agent: "replication-skeptic", text: "Seeds are reported for §5.1 only. Appendix C mentions \"three runs\" without giving variance. For an empirical result this hinges on, I would expect at least error bars on Figure 4.", ev: [{ ref: "§5.1", label: "seeds" }, { ref: "Fig. 4", label: "no error bars" }] },
    { r: 2, label: "cross-examination", agent: "constructive-advocate", text: "To the Methods Critic — Table 3 does hold tokens-per-seat constant (see footnote 6), so the FLOPs objection is partially addressed. The disagreement-quality metric, however, is genuinely under-specified and deserves a formal definition.", ev: [{ ref: "fn. 6", label: "tokens/seat" }], streaming: true },
  ];

  // group by round
  const byRound = {};
  messages.forEach(m => { (byRound[m.r] = byRound[m.r] || []).push(m); });

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #ececf1",
      borderRadius: 14,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Roster */}
      <div style={{
        padding: "12px 18px",
        borderBottom: "1px solid #f0f0f2",
        background: "rgba(250,250,250,0.7)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span className="micro">Panel</span>
        <div style={{ display: "flex" }}>
          {agents.map((a, i) => (
            <div key={a.id} title={a.name} style={{
              width: 22, height: 22, borderRadius: "50%",
              background: a.color, color: "#fff",
              font: "700 9px Georgia, serif",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
              marginLeft: i === 0 ? 0 : -6,
            }}>{a.initial}</div>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: "#71717a" }}>{agents.length} reviewers · 2 rounds</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
          fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.2s ease-in-out infinite" }} />
          in progress
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 18px" }}>
        {Object.entries(byRound).map(([r, ms]) => (
          <React.Fragment key={r}>
            <RoundDivider n={r} label={ms[0].label} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ms.map((m, i) => (
                <AgentMessage
                  key={i}
                  agent={byId[m.agent]}
                  round={m.r}
                  label={m.label}
                  text={m.text}
                  streaming={m.streaming}
                  evidence={m.ev}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
