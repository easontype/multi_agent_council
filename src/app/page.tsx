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
    <div style={{ minHeight: "100vh", background: "#fff", color: "#111827" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #e5e7eb",
        padding: "0 32px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#6366f1", letterSpacing: "-0.02em" }}>Council</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", paddingTop: 2 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="#pricing" style={{ color: "#4b5563", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Pricing</a>
          <a href="/login" style={{ color: "#4b5563", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Sign in</a>
          <a href="/login" style={{
            background: "#6366f1",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}>Get started</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "96px 32px 80px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          color: "#4f46e5",
          padding: "5px 14px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 28,
          letterSpacing: "0.05em",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
          MULTI-AGENT PEER REVIEW
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 54px)",
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 24,
          color: "#111827",
          letterSpacing: "-0.03em",
        }}>
          Get honest feedback on<br />
          <span style={{ color: "#6366f1" }}>your paper before submission</span>
        </h1>

        <p style={{
          color: "#4b5563",
          fontSize: 18,
          maxWidth: 560,
          margin: "0 auto 12px",
          lineHeight: 1.7,
        }}>
          Five specialized AI reviewers debate your work — methods, literature, reproducibility,
          contribution, and advocacy — then a moderator delivers a structured verdict.
        </p>
        <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 48 }}>
          Built for PhD students, postdocs, and research teams.
        </p>

        {/* Quick input */}
        <form onSubmit={handleQuickCritique} style={{
          display: "flex",
          gap: 8,
          maxWidth: 480,
          margin: "0 auto 16px",
        }}>
          <input
            type="text"
            value={arxivId}
            onChange={(e) => setArxivId(e.target.value)}
            placeholder="arXiv ID e.g. 2301.07041"
            style={{
              flex: 1,
              fontSize: 15,
              height: 48,
              border: "1.5px solid #d1d5db",
              borderRadius: 8,
              padding: "0 16px",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
          />
          <button
            type="submit"
            disabled={loading || !arxivId.trim()}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0 24px",
              fontSize: 15,
              fontWeight: 600,
              height: 48,
              opacity: loading || !arxivId.trim() ? 0.55 : 1,
              cursor: loading || !arxivId.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Loading…" : "Critique Paper"}
          </button>
        </form>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>
          Free — 10 reviews/day, no account required
        </p>
      </section>

      {/* Roles strip */}
      <section style={{ borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", background: "#f9fafb", padding: "24px 32px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.06em", marginRight: 8 }}>YOUR COMMITTEE:</span>
          {[
            { label: "Methods Critic", color: "#6366f1" },
            { label: "Literature Auditor", color: "#0ea5e9" },
            { label: "Replication Skeptic", color: "#f43f5e" },
            { label: "Contribution Evaluator", color: "#f59e0b" },
            { label: "Constructive Advocate", color: "#22c55e" },
            { label: "Moderator", color: "#374151" },
          ].map((r) => (
            <span key={r.label} style={{
              background: `${r.color}14`,
              border: `1px solid ${r.color}33`,
              color: r.color,
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: 20,
            }}>{r.label}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
          How it works
        </h2>
        <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 52 }}>
          From arXiv ID to structured verdict in minutes.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          {[
            {
              n: "1",
              title: "Ingest",
              body: "Paste an arXiv ID or upload a PDF. The paper is parsed, chunked, and embedded into the review knowledge base.",
            },
            {
              n: "2",
              title: "Debate",
              body: "Five reviewers each write a Round 1 critique independently. Divergence is measured — if high, Round 2 cross-examination runs.",
            },
            {
              n: "3",
              title: "Verdict",
              body: "A moderator synthesizes all arguments into a structured report: consensus, dissent, action items, and confidence score.",
            },
          ].map((s) => (
            <div key={s.n} style={{ textAlign: "center" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#eef2ff", border: "1.5px solid #c7d2fe",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 18, color: "#6366f1",
                margin: "0 auto 16px",
              }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{s.title}</div>
              <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.65 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get — sample verdict */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "80px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em", textAlign: "center" }}>
            What you get
          </h2>
          <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 48, textAlign: "center" }}>
            A structured verdict from five perspectives, not a single AI opinion.
          </p>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            {/* Mock verdict preview */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12, background: "#f9fafb" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>⚖</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Moderator Verdict</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Synthesized from all 5 reviewers</div>
              </div>
              <span style={{ marginLeft: "auto", background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4 }}>MEDIUM CONFIDENCE</span>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <VerdictRow label="Summary" text="The paper makes a genuine contribution to the field but raises concerns about reproducibility and ablation coverage that reviewers feel must be addressed before publication." />
              <VerdictRow label="Consensus" text="The core mechanism is novel and the experimental setup is largely sound. Reviewers agreed on the importance of the contribution." />
              <VerdictRow label="Key Dissent" text="The Replication Skeptic flagged missing training details and hyperparameter disclosures that would prevent independent reproduction." />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 8 }}>ACTION ITEMS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["Add ablation study isolating the key architectural choice.", "Publish training code and full hyperparameter configuration.", "Expand related work comparison with contemporaneous methods."].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 48, letterSpacing: "-0.02em", textAlign: "center" }}>
          Built for researchers
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          {[
            {
              who: "PhD Students",
              what: "Get hostile reviewer feedback before your advisor sees the draft. Find the weaknesses you missed.",
              cta: "Critique a paper",
              href: "/analyze",
            },
            {
              who: "Postdocs & PIs",
              what: "Pre-submission gut-check before journal submission. Identify the arguments reviewers will use to reject.",
              cta: "Start review",
              href: "/analyze",
            },
            {
              who: "Research Teams",
              what: "Use the API to run automated paper triage, literature gap analysis, and related work audits at scale.",
              cta: "Get API key",
              href: "/keys",
            },
          ].map((u) => (
            <div key={u.who} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{u.who}</div>
              <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.65, flex: 1 }}>{u.what}</div>
              <a href={u.href} style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", textDecoration: "none" }}>{u.cta} →</a>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "80px 32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em", textAlign: "center" }}>
            Simple pricing
          </h2>
          <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 48, textAlign: "center" }}>No subscriptions. No seat fees.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <PricingCard
              tier="Free"
              price="$0"
              per="forever"
              features={["10 reviews per day", "Full 5-reviewer committee", "2-round debate", "Moderator verdict", "arXiv + PDF support"]}
              cta="Start for free"
              ctaHref="/analyze"
              highlight={false}
            />
            <PricingCard
              tier="Pro"
              price="$20"
              per="one-time"
              features={["500 reviews per day", "API access (all endpoints)", "Programmatic session control", "Gap Analysis mode", "Priority compute"]}
              cta="Buy access"
              ctaHref="/keys"
              highlight={true}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "40px 32px", textAlign: "center", color: "#9ca3af", fontSize: 13, borderTop: "1px solid #f3f4f6" }}>
        <div style={{ marginBottom: 12, fontWeight: 700, color: "#6366f1", fontSize: 16 }}>Council</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16 }}>
          <a href="/analyze" style={{ color: "#9ca3af", textDecoration: "none" }}>Try it free</a>
          <a href="/keys" style={{ color: "#9ca3af", textDecoration: "none" }}>API Keys</a>
          <a href="#pricing" style={{ color: "#9ca3af", textDecoration: "none" }}>Pricing</a>
        </div>
        AI-powered peer review — not a substitute for human expert review.
      </footer>
    </div>
  );
}

function VerdictRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

function PricingCard({ tier, price, per, features, cta, ctaHref, highlight }: {
  tier: string; price: string; per: string; features: string[];
  cta: string; ctaHref: string; highlight: boolean;
}) {
  return (
    <div style={{
      background: highlight ? "#6366f1" : "#fff",
      border: `1.5px solid ${highlight ? "#6366f1" : "#e5e7eb"}`,
      borderRadius: 12,
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      boxShadow: highlight ? "0 8px 32px rgba(99,102,241,0.25)" : "none",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "rgba(255,255,255,0.7)" : "#9ca3af", letterSpacing: "0.06em", marginBottom: 8 }}>{tier.toUpperCase()}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: highlight ? "#fff" : "#111827", letterSpacing: "-0.03em" }}>{price}</span>
          <span style={{ fontSize: 13, color: highlight ? "rgba(255,255,255,0.6)" : "#9ca3af" }}>{per}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {features.map((f) => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: highlight ? "rgba(255,255,255,0.8)" : "#22c55e", fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 14, color: highlight ? "rgba(255,255,255,0.9)" : "#4b5563", lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>
      <a href={ctaHref} style={{
        display: "block",
        textAlign: "center",
        background: highlight ? "#fff" : "#6366f1",
        color: highlight ? "#6366f1" : "#fff",
        padding: "11px 0",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        textDecoration: "none",
      }}>{cta}</a>
    </div>
  );
}
