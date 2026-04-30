/** @jsx React.createElement */
/* global React, CouncilIcon */

const { useState } = React;

// ------- Header chrome -------
window.AppHeader = function AppHeader({ paper }) {
  return (
    <header style={{
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid #ececf1",
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "#52525b", display: "flex" }}>
          <CouncilIcon name="back" size={15} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1", letterSpacing: "-0.01em" }}>Council</span>
        <span style={{ background: "#eef2ff", color: "#6366f1", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 3 }}>Beta</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#a1a1aa", display: "flex" }}><CouncilIcon name="paper" size={13} /></span>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "#27272a", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 }}>
          {paper.title}
        </span>
        <span className="micro" style={{ letterSpacing: "0.08em" }}>Under Review</span>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn-ghost"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CouncilIcon name="link" size={11} />Copy Share URL</span></button>
        <button className="btn-ghost"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CouncilIcon name="lock" size={11} />Make Private</span></button>
      </div>
    </header>
  );
};

// ------- Paper preview (left panel) -------
window.PaperPreview = function PaperPreview({ paper }) {
  return (
    <div style={{
      background: "#fcfcfb",
      border: "1px solid #ececf1",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f2", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.6)" }}>
        <span className="micro" style={{ color: "#71717a" }}>Paper</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#a1a1aa" }} className="mono">{paper.pages}p · arxiv</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 30px", background: "#fff" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.25, color: "#111", marginBottom: 10 }}>
          {paper.title}
        </div>
        <div style={{ fontSize: 12, color: "#71717a", fontStyle: "italic", marginBottom: 4 }}>{paper.authors}</div>
        <div style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 20 }} className="mono">{paper.venue}</div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#a1a1aa", textTransform: "uppercase", marginBottom: 8 }}>Abstract</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#27272a", lineHeight: 1.75, letterSpacing: "-0.005em", textAlign: "justify", textJustify: "inter-word" }}>
          {paper.abstract}
        </div>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #f0f0f2" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#111" }}>1. Introduction</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#3f3f46", lineHeight: 1.8, textAlign: "justify" }}>
            Peer review remains the primary quality gate for scientific publication, yet the reviewer pool is strained and single-reviewer judgment is known to be noisy. We ask whether a structured panel of specialized agents — each tasked with a distinct reviewer archetype — can recover the signal of expert review while remaining cheap to deploy…
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#3f3f46", lineHeight: 1.8, textAlign: "justify", marginTop: 10 }}>
            Prior work on automated review [12, 18, 24] has focused on single-model scoring. In contrast, we treat review as a debate in which disagreement between panelists is itself a signal of paper fragility…
          </div>
        </div>
      </div>
    </div>
  );
};
