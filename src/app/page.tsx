"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [arxivId, setArxivId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleQuickCritique(e: React.FormEvent) {
    e.preventDefault();
    if (!arxivId.trim()) return;
    setLoading(true);
    router.push(`/analyze?arxiv=${encodeURIComponent(arxivId.trim())}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>Council</span>
        <a href="/analyze" style={{
          background: "var(--accent)",
          color: "#fff",
          padding: "6px 16px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}>Start Review</a>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "80px 24px 60px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          background: "var(--accent-dim)",
          color: "var(--accent)",
          padding: "4px 14px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 20,
          letterSpacing: "0.05em",
        }}>MULTI-AGENT PEER REVIEW</div>

        <h1 style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: 20,
          color: "var(--text-primary)",
        }}>
          AI Peer Review Committee<br />
          <span style={{ color: "var(--accent)" }}>for Your Research</span>
        </h1>

        <p style={{
          color: "var(--text-secondary)",
          fontSize: 17,
          maxWidth: 540,
          margin: "0 auto 40px",
          lineHeight: 1.7,
        }}>
          Five specialized AI reviewers debate your paper in parallel — methods critic,
          literature auditor, replication skeptic, contribution evaluator, and constructive
          advocate — then a moderator synthesizes a structured verdict.
        </p>

        {/* Quick input */}
        <form onSubmit={handleQuickCritique} style={{
          display: "flex",
          gap: 8,
          maxWidth: 460,
          margin: "0 auto 48px",
        }}>
          <input
            type="text"
            value={arxivId}
            onChange={(e) => setArxivId(e.target.value)}
            placeholder="arXiv ID e.g. 2301.07041"
            style={{ flex: 1, fontSize: 15, height: 44 }}
          />
          <button
            type="submit"
            disabled={loading || !arxivId.trim()}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "0 20px",
              fontSize: 14,
              fontWeight: 600,
              height: 44,
              opacity: loading || !arxivId.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "..." : "Critique"}
          </button>
        </form>

        {/* Action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          <ActionCard
            href="/analyze"
            title="Critique a Paper"
            description="Enter an arXiv ID or paste text to run a full peer-review committee on any paper."
            badge="arXiv / DOI"
            badgeColor="var(--accent)"
          />
          <ActionCard
            href="/analyze?mode=gap"
            title="Review My Paper"
            description="Upload your own draft and get a gap analysis from hostile and supportive reviewers."
            badge="Gap Analysis"
            badgeColor="var(--warning)"
          />
        </div>
      </section>

      {/* How it works */}
      <section style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "64px 24px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 700, marginBottom: 40 }}>
            How it works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            <Step
              number="1"
              title="Ingest"
              description="Paste an arXiv ID, upload a PDF, or provide text. The paper is parsed and embedded into the review knowledge base."
            />
            <Step
              number="2"
              title="Debate"
              description="Five specialized AI reviewers each write an independent Round 1 critique. Divergence is measured, then Round 2 cross-examination runs if needed."
            />
            <Step
              number="3"
              title="Review"
              description="A moderator synthesizes all arguments into a structured verdict: consensus, key dissents, action items, and confidence score."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "32px 24px",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}>
        Council — AI Peer Review Engine
      </footer>
    </div>
  );
}

function ActionCard({ href, title, description, badge, badgeColor }: {
  href: string; title: string; description: string; badge: string; badgeColor: string;
}) {
  return (
    <a href={href} style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 20,
      display: "block",
      textAlign: "left",
      textDecoration: "none",
      transition: "border-color 150ms ease",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      <span style={{
        background: `${badgeColor}22`,
        color: badgeColor,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        letterSpacing: "0.06em",
        display: "inline-block",
        marginBottom: 10,
      }}>{badge}</span>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: "var(--text-primary)" }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{description}</div>
    </a>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: "50%",
        background: "var(--accent-dim)",
        color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 18,
        margin: "0 auto 16px",
        border: "1px solid var(--border-accent)",
      }}>{number}</div>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{title}</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>{description}</div>
    </div>
  );
}
