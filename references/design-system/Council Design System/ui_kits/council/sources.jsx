/** @jsx React.createElement */
/* global React, CouncilIcon */

// ------- Cited sources sidebar -------
window.SourcesPanel = function SourcesPanel({ agents }) {
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  const sources = [
    { title: "AI Safety via Debate", authors: "Irving, Christiano, Amodei — 2018", ref: "arXiv:1805.00899", by: "literature-auditor" },
    { title: "The Curious Case of Neural Text Degeneration", authors: "Holtzman et al. — ICLR 2020", ref: "arXiv:1904.09751", by: "methods-critic" },
    { title: "Improving Factuality and Reasoning via Multiagent Debate", authors: "Du, Li, Torralba, Tenenbaum — 2023", ref: "arXiv:2305.14325", by: "literature-auditor" },
    { title: "Scaling Laws for Neural Language Models", authors: "Kaplan et al. — 2020", ref: "arXiv:2001.08361", by: "replication-skeptic" },
    { title: "Self-Consistency Improves Chain of Thought", authors: "Wang et al. — ICLR 2023", ref: "arXiv:2203.11171", by: "contribution-evaluator" },
  ];

  return (
    <div style={{
      background: "#fafafa",
      border: "1px solid #ececf1",
      borderRadius: 14,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f2", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)" }}>
        <span style={{ color: "#71717a", display: "flex" }}><CouncilIcon name="book" size={13} /></span>
        <span className="micro">Cited sources</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#a1a1aa" }}>{sources.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {sources.map((s, i) => {
          const a = byId[s.by];
          return (
            <div key={i} style={{
              background: "#fff",
              border: "1px solid #ececf1",
              borderLeft: `3px solid ${a.color}`,
              borderRadius: "0 10px 10px 0",
              padding: "10px 12px",
              cursor: "pointer",
              transition: "box-shadow 150ms ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 12.5, fontWeight: 600, color: "#18181b", letterSpacing: "-0.005em", lineHeight: 1.4 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{s.authors}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ background: a.color + "0f", border: `1px solid ${a.color}33`, color: a.color, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999 }}>
                      cited by {a.name.split(" ")[0]}
                    </span>
                    <span style={{ background: "#f5f5f7", border: "1px solid #ececf1", color: "#71717a", fontSize: 10, padding: "1px 7px", borderRadius: 999 }} className="mono">{s.ref}</span>
                  </div>
                </div>
                <span style={{ color: "#a1a1aa", display: "flex", paddingTop: 2 }}><CouncilIcon name="ext" size={11} /></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------- Moderator verdict (share/read-only surface) -------
window.ModeratorVerdict = function ModeratorVerdict() {
  return (
    <div style={{
      background: "#fcfcfb",
      border: "1px solid #ececf1",
      borderRadius: 16,
      padding: "28px 32px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="micro">Moderator Verdict</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, color: "#3f6b52",
          border: "1px solid #3f6b52", borderRadius: 999, padding: "2px 10px",
        }}>high confidence</span>
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111", lineHeight: 1.4 }}>
        Strong methodology, weak positioning.
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#27272a", lineHeight: 1.8, marginTop: 12, textAlign: "justify" }}>
        The empirical core of the paper is sound: panel-size ablations are FLOPs-matched, seeds are reported, and the Council-Bench release is substantive. The framing, however, understates its closest precedent (Irving et al., 2018) and the disagreement-quality metric lacks a formal definition. Addressing §1 and §3.2 would move this from borderline to accept.
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f2", display: "flex", gap: 16, fontSize: 11.5, color: "#71717a" }}>
        <span><strong style={{ color: "#18181b" }}>Dissent:</strong> Contribution Evaluator</span>
        <span><strong style={{ color: "#18181b" }}>Consensus:</strong> 4 / 5</span>
        <span style={{ marginLeft: "auto" }} className="mono">2 rounds · 5 reviewers</span>
      </div>
    </div>
  );
};
