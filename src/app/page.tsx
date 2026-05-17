"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { setPendingUpload } from "@/lib/pending-upload";

const T = {
  page:        "#f3efe7",
  pageGlow:    "#fbfaf6",
  ink:         "#1e1b18",
  muted:       "#6c665f",
  softMuted:   "#9d968d",
  border:      "#d9d1c4",
  borderStrong:"#c9bdac",
  panel:       "rgba(255,255,255,0.84)",
  panelStrong: "#fffdf8",
  accent:      "#25493d",
  accentMid:   "#3d6b5f",
  accentLight: "#edf4f1",
} as const;

const serif  = "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const sans   = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Stripe upgrade button ───────────────────────────────────────────────────
function UpgradeButton({ style }: { style?: React.CSSProperties }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    try {
      const res  = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
      else setLoading(false);
    } catch { setLoading(false); }
  }
  return (
    <button onClick={handleClick} disabled={loading} style={{
      border: "none", borderRadius: 10, padding: "13px 28px",
      background: T.accent, color: "#fff",
      fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
      opacity: loading ? 0.7 : 1, transition: "opacity 120ms",
      fontFamily: sans,
      ...style,
    }}>
      {loading ? "Redirecting…" : "Get Pro"}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [arxivId, setArxivId]   = useState("");
  const [loading, setLoading]   = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  function handleQuickCritique(e: React.FormEvent) {
    e.preventDefault();
    if (!arxivId.trim()) return;
    setLoading(true);
    router.push(`/home?arxiv=${encodeURIComponent(arxivId.trim())}`);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUpload(file);
    router.push("/home");
  }

  return (
    <div style={{ background: `linear-gradient(180deg, ${T.pageGlow} 0%, ${T.page} 100%)`, minHeight: "100dvh", fontFamily: sans, color: T.ink }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 60,
        background: `${T.pageGlow}ee`,
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: T.accent, letterSpacing: "-0.02em" }}>
            Council
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: T.softMuted }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#modes"   style={{ fontSize: 13, color: T.muted, textDecoration: "none" }}>Modes</a>
          <a href="#pricing" style={{ fontSize: 13, color: T.muted, textDecoration: "none" }}>Pricing</a>
          {session?.user ? (
            <a href="/home" style={{
              padding: "7px 18px", borderRadius: 8,
              background: T.accent, color: "#fff",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>Dashboard</a>
          ) : (
            <>
              <a href="/login" style={{ fontSize: 13, color: T.muted, textDecoration: "none" }}>Sign in</a>
              <a href="/login" style={{
                padding: "7px 18px", borderRadius: 8,
                background: T.accent, color: "#fff",
                fontSize: 13, fontWeight: 700, textDecoration: "none",
              }}>Get started</a>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="lp-hero-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 40px 64px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          {/* Eyebrow */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.border}`, background: T.panel, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted }}>MULTI-AGENT PEER REVIEW</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: serif, fontSize: "clamp(34px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.025em", color: T.ink, marginBottom: 20 }}>
            Honest feedback on your paper,{" "}
            <span style={{ color: T.accent }}>before submission.</span>
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.75, color: T.muted, marginBottom: 32, maxWidth: 460 }}>
            Five domain-specialized AI reviewers debate your work — methods, literature, reproducibility,
            contribution, and advocacy — then a moderator delivers a structured verdict with action items.
          </p>

          {/* arXiv input */}
          <form onSubmit={handleQuickCritique} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={arxivId}
              onChange={e => setArxivId(e.target.value)}
              placeholder="Paste arXiv ID — e.g. 2301.07041"
              style={{
                flex: 1, height: 48, padding: "0 16px",
                border: `1.5px solid ${T.border}`, borderRadius: 10,
                background: T.panelStrong, color: T.ink,
                fontSize: 14, outline: "none", fontFamily: sans,
              }}
            />
            <button type="submit" disabled={loading || !arxivId.trim()} style={{
              height: 48, padding: "0 22px", borderRadius: 10,
              border: "none", background: T.accent, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: (loading || !arxivId.trim()) ? "not-allowed" : "pointer",
              opacity: (loading || !arxivId.trim()) ? 0.55 : 1,
              transition: "opacity 120ms", whiteSpace: "nowrap", fontFamily: sans,
            }}>
              {loading ? "Loading…" : "Critique Paper"}
            </button>
          </form>

          {/* Alternative inputs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center", fontSize: 12, color: T.softMuted }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <UploadIcon />
              <span style={{ color: T.accentMid, fontWeight: 600 }}>Upload PDF</span>
              <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={handlePdfChange} />
            </label>
            <span style={{ color: T.border }}>·</span>
            <a href="/home" style={{ color: T.accentMid, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <LinkIcon /> Paste PDF URL
            </a>
            <span style={{ color: T.border }}>·</span>
            <a href="/home" style={{ color: T.accentMid, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <TextIcon /> Paste text
            </a>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: T.softMuted }}>
            Free · 10 reviews/week · No account required
          </p>
        </div>

        {/* Right: mock debate preview */}
        <div style={{ position: "relative" }}>
          <div style={{
            background: T.panelStrong, border: `1px solid ${T.border}`,
            borderRadius: 18, boxShadow: "0 20px 48px rgba(63,43,24,0.1)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
              background: "linear-gradient(180deg, rgba(248,242,232,0.7) 0%, rgba(255,255,255,0.9) 100%)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: T.softMuted, marginBottom: 3 }}>LIVE REVIEW</div>
                <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: T.ink }}>Attention Is All You Need</div>
              </div>
              <span style={{ padding: "3px 9px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>RUNNING</span>
            </div>
            {/* Agent turns */}
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {PREVIEW_TURNS.map((turn, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: turn.color + "22", border: `1.5px solid ${turn.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: turn.color,
                  }}>
                    {turn.initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: turn.color, letterSpacing: "0.05em", marginBottom: 3 }}>{turn.role}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.55, color: T.muted }}>{turn.snippet}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 10, background: T.accentLight, border: `1px solid #bfd4c8` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.accent, marginBottom: 4 }}>MODERATOR VERDICT</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: "#2f5a49" }}>
                  Major Revision — ablation coverage and training detail are the blocking concerns.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Domains strip ────────────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.panel, padding: "18px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: T.softMuted, marginRight: 6 }}>RESEARCH DOMAIN:</span>
          {DOMAINS.map(d => (
            <span key={d.label} style={{
              padding: "5px 13px", borderRadius: 999,
              border: `1.5px solid ${T.borderStrong}`,
              background: T.panelStrong,
              fontSize: 12, fontWeight: 600, color: T.muted,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>{d.icon}</span>
              {d.label}
              <span style={{ fontSize: 10, color: T.softMuted }}>— {d.sub}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── 4 Modes ──────────────────────────────────────────────────────── */}
      <section id="modes" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 40px" }}>
        <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted }}>REVIEW MODES</div>
        <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 8 }}>Four ways to stress-test your research</h2>
        <p style={{ fontSize: 14, color: T.muted, marginBottom: 40, maxWidth: 560 }}>
          Pick the mode that matches your stage — from pre-submission critique to adversarial material comparison.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          {MODES.map(m => (
            <a key={m.title} href="/home" style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 12, padding: "22px 22px 20px", borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.panelStrong, boxShadow: "0 4px 16px rgba(63,43,24,0.05)", transition: "box-shadow 150ms" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.accentLight, border: `1px solid #bfd4c8`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <m.Icon />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 5 }}>{m.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: T.muted }}>{m.desc}</div>
              </div>
              {m.badge && (
                <div style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: T.accentLight, border: `1px solid #bfd4c8`, width: "fit-content" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: T.accent }}>{m.badge}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* ── Agent committee ──────────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${T.border}`, background: T.panel }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 40px" }}>
          <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted }}>YOUR COMMITTEE</div>
          <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 6 }}>Specialized reviewers, not a generalist</h2>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 32, maxWidth: 520 }}>Each seat targets a distinct failure mode. All reviewers read the actual paper text via RAG.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {AGENTS.map(a => (
              <div key={a.label} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 14px", borderRadius: 999,
                border: `1px solid ${a.color}33`,
                background: `${a.color}0d`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 40px" }}>
        <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted }}>HOW IT WORKS</div>
        <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 48 }}>From paper to structured verdict in minutes</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: `1.5px solid ${T.borderStrong}`,
                background: T.panelStrong,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                fontSize: 14, fontWeight: 800, color: T.ink,
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: T.muted }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you get ─────────────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.panelStrong} 0%, ${T.page} 100%)` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 40px" }}>
          <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted }}>OUTPUTS</div>
          <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 8 }}>More than an opinion — a revision plan</h2>
          <p style={{ fontSize: 14, color: T.muted, marginBottom: 48, maxWidth: 540 }}>Every session produces a structured report plus tools to dig deeper into the evidence.</p>

          <div className="lp-outputs-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
            {/* Verdict mock — left, tall */}
            <div style={{ background: T.panelStrong, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 8px 28px rgba(63,43,24,0.07)", overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
                background: "linear-gradient(180deg, rgba(248,242,232,0.7) 0%, rgba(255,255,255,0.9) 100%)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ScalesIcon />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Moderator Verdict</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Synthesized from all 5 reviewers</div>
                </div>
                <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 999, background: "#fff3d9", border: "1px solid #efc87b", fontSize: 10, fontWeight: 700, color: "#8b5a18" }}>MEDIUM CONFIDENCE</span>
              </div>
              <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <VerdictRow label="Summary" text="The paper makes a genuine contribution but raises reproducibility concerns reviewers feel must be addressed before publication." />
                <VerdictRow label="Consensus" text="Core mechanism is novel. Experimental setup is largely sound. All reviewers agreed on the importance of the contribution." />
                <VerdictRow label="Key Dissent" text="Replication Skeptic flagged missing training details that would prevent independent reproduction." />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.softMuted, marginBottom: 10 }}>ACTION ITEMS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ACTION_ITEMS.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", borderRadius: 8, background: T.accentLight, border: `1px solid #c9ddd8` }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: T.accent, marginTop: 1, flexShrink: 0 }}>
                          {i === 0 ? "BLOCKING" : i === 1 ? "REC" : "OPT"}
                        </span>
                        <span style={{ fontSize: 12, lineHeight: 1.5, color: T.ink }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: 3 output feature cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {OUTPUT_FEATURES.map(f => (
                <div key={f.title} style={{ background: T.panelStrong, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 4px 14px rgba(63,43,24,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accentLight, border: `1px solid #c9ddd8`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <f.Icon />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{f.title}</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: T.muted }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Adversarial debate callout ────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 40px 48px" }}>
        <div className="lp-debate-grid" style={{
          borderRadius: 20, border: `1.5px solid #c4dcd5`,
          background: "linear-gradient(135deg, #edf4f1 0%, #e0efeb 100%)",
          overflow: "hidden", display: "grid", gridTemplateColumns: "1fr auto",
        }}>
          <div style={{ padding: "36px 40px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, background: "rgba(255,255,255,0.7)", border: `1px solid #b0ccd3`, marginBottom: 18 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.accent }}>ADVERSARIAL MODE</span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 12, maxWidth: 400 }}>
              Compare two approaches with a live AI debate
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: T.accentMid, marginBottom: 24, maxWidth: 420 }}>
              MXene vs Graphene. CRISPR vs TALENs. ResNet vs ViT. Specialist reviewers argue both sides simultaneously — then the moderator delivers an evidence-based verdict.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {["Mirror Teams", "Domain Specialists", "Evidence-Based Verdict"].map(tag => (
                <span key={tag} style={{ padding: "4px 12px", borderRadius: 999, background: "rgba(255,255,255,0.8)", border: `1px solid #b0ccd3`, fontSize: 11, fontWeight: 600, color: T.accent }}>
                  {tag}
                </span>
              ))}
            </div>
            <a href="/home" style={{
              display: "inline-block", padding: "11px 22px",
              borderRadius: 10, background: T.accent, color: "#fff",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              Start a debate →
            </a>
          </div>
          {/* Right visual */}
          <div className="lp-debate-aside" style={{ padding: "36px 40px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, minWidth: 200, borderLeft: `1px solid #c4dcd5` }}>
            {[
              { side: "TEAM A", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
              { side: "TEAM B", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            ].map(t => (
              <div key={t.side} style={{ padding: "12px 16px", borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: t.color, marginBottom: 4 }}>{t.side}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>2–3 Specialists</div>
              </div>
            ))}
            <div style={{ padding: "10px 16px", borderRadius: 12, background: T.panelStrong, border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>+ Moderator</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 40px 64px" }}>
        <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, marginBottom: 32, textAlign: "center" }}>Built for every stage of research</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {USE_CASES.map(u => (
            <div key={u.who} style={{ padding: "22px 20px", borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.panelStrong, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{u.who}</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: T.muted, flex: 1 }}>{u.what}</div>
              <a href="/home" style={{ fontSize: 12, fontWeight: 700, color: T.accent, textDecoration: "none" }}>{u.cta} →</a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.panel }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "64px 40px" }}>
          <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.softMuted, textAlign: "center" }}>PRICING</div>
          <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, textAlign: "center", marginBottom: 6 }}>Simple pricing</h2>
          <p style={{ fontSize: 14, color: T.muted, textAlign: "center", marginBottom: 40 }}>Cancel anytime. No seat fees.</p>
          <div className="lp-pricing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Free */}
            <div style={{ padding: "28px 26px", borderRadius: 16, border: `1.5px solid ${T.border}`, background: T.panelStrong, display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.softMuted, marginBottom: 10 }}>FREE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: T.ink }}>$0</span>
                  <span style={{ fontSize: 13, color: T.softMuted }}>forever</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {FREE_FEATURES.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: T.accent, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/home" style={{ display: "block", padding: "11px", borderRadius: 9, background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>Start for free</a>
            </div>
            {/* Pro */}
            <div style={{ padding: "28px 26px", borderRadius: 16, border: `2px solid ${T.accent}`, background: T.accent, display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>PRO</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: "#fff" }}>$14</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>/month</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {PRO_FEATURES.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <UpgradeButton style={{ width: "100%", background: "#fff", color: T.accent, padding: "11px" }} />
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 680px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; padding: 48px 20px 40px !important; }
          .lp-outputs-grid { grid-template-columns: 1fr !important; }
          .lp-debate-grid { grid-template-columns: 1fr !important; }
          .lp-debate-aside { display: none !important; }
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ padding: "40px", textAlign: "center", borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: T.accent, marginBottom: 16 }}>Council</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 20 }}>
          {[["Try it free", "/home"], ["Compare papers", "/home/compare"], ["Pricing", "#pricing"], ["Sign in", "/login"]].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 12, color: T.softMuted, textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <p style={{ fontSize: 11, color: T.softMuted, maxWidth: 400, margin: "0 auto" }}>
          AI-powered peer review — not a substitute for human expert review.
        </p>
      </footer>

    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PREVIEW_TURNS = [
  { role: "Methods Critic", initial: "M", color: "#6366f1", snippet: "The ablation study is insufficient — it conflates two architectural decisions without isolating their individual contributions." },
  { role: "Literature Auditor", initial: "L", color: "#0ea5e9", snippet: "Key 2022–2023 work on sparse attention is unaddressed. The related work section requires significant expansion." },
  { role: "Replication Skeptic", initial: "R", color: "#f43f5e", snippet: "Training hyperparameters are missing. Independent reproduction is not currently feasible from this paper alone." },
];

const DOMAINS = [
  { label: "General",    sub: "Multidisciplinary",     icon: "◈" },
  { label: "Materials",  sub: "Chemistry & Engineering", icon: "◆" },
  { label: "Biomedical", sub: "Life Sciences",           icon: "◉" },
  { label: "Physics",    sub: "Devices & Systems",       icon: "◎" },
];

const MODES = [
  {
    title: "Academic Critique",
    desc: "5 reviewers each attack the paper from a different angle: methods, literature, replication, contribution, and advocacy. Round 2 cross-examination runs if reviewers strongly disagree.",
    badge: "DEFAULT",
    Icon: () => <CritiqueIcon />,
  },
  {
    title: "Gap Analysis",
    desc: "6 agents focused on finding what's missing: thin sections, unstated assumptions, missing citations (2022–2025), and a roadmap for revision.",
    badge: undefined,
    Icon: () => <GapIcon />,
  },
  {
    title: "Adversarial Debate",
    desc: "Split reviewers into Team A vs Team B, each defending a different approach or material. Interleaved cross-examination, then a moderator verdict with a winning side.",
    badge: "PRO",
    Icon: () => <DebateIcon />,
  },
  {
    title: "Compare Papers",
    desc: "Analyze 2–4 papers side-by-side across methodology, experiments, contributions, limitations, and novelty. Returns a structured comparison table with a synthesis verdict.",
    badge: "PRO",
    Icon: () => <CompareIcon />,
  },
];

const AGENTS = [
  { label: "Methods Critic",         color: "#6366f1" },
  { label: "Literature Auditor",     color: "#0ea5e9" },
  { label: "Replication Skeptic",    color: "#f43f5e" },
  { label: "Contribution Evaluator", color: "#f59e0b" },
  { label: "Constructive Advocate",  color: "#22c55e" },
  { label: "Gap Finder",             color: "#8b5cf6" },
  { label: "Hostile Reviewer",       color: "#ef4444" },
  { label: "Methods Auditor",        color: "#14b8a6" },
  { label: "Related Work Scout",     color: "#f97316" },
  { label: "Supportive Mentor",      color: "#22c55e" },
  { label: "Moderator",              color: "#6b7280" },
];

const STEPS = [
  {
    title: "Ingest your paper",
    body: "Paste an arXiv ID, upload a PDF (up to 20 MB), drop in a PDF URL, or paste text directly. The paper is parsed, chunked, and embedded into a per-session knowledge base.",
  },
  {
    title: "Reviewers debate",
    body: "All agents read the paper via RAG and write independently in Round 1. If divergence is high, Round 2 cross-examination runs — each reviewer reads the others' arguments before responding.",
  },
  {
    title: "Get your verdict",
    body: "A moderator synthesizes all arguments into a structured report: editorial decision, consensus, key dissent, prioritized action items, and confidence score.",
  },
];

const ACTION_ITEMS = [
  "Add ablation study isolating the key architectural choice.",
  "Publish training code and full hyperparameter configuration.",
  "Expand related work comparison with contemporaneous methods.",
];

const OUTPUT_FEATURES = [
  {
    title: "Citation Coverage Map",
    desc: "See exactly which sections of your paper agents cited — and which sections were ignored. Surfaces blind spots in the evidence base.",
    Icon: () => <MapIcon />,
  },
  {
    title: "Chat with Paper",
    desc: "Follow-up Q&A grounded in the reviewed paper. Ask the system to elaborate on any verdict point, using RAG over the ingested document.",
    Icon: () => <ChatIcon />,
  },
  {
    title: "Export & Share",
    desc: "Download the full session as structured Markdown, or publish a read-only share link. Full evidence references included.",
    Icon: () => <ExportIcon />,
  },
];

const USE_CASES = [
  {
    who: "PhD Students",
    what: "Get hostile reviewer feedback before your advisor sees the draft. Catch the reproducibility gaps and weak ablations before they appear in a rejection letter.",
    cta: "Critique a draft",
  },
  {
    who: "Postdocs & PIs",
    what: "Pre-submission gut-check before journal submission. Find the arguments reviewers will use to reject, and fix them first.",
    cta: "Start a review",
  },
  {
    who: "Research Teams",
    what: "Run gap analysis and literature audits across multiple papers. Use adversarial mode to settle internal debates about methods or materials.",
    cta: "Run gap analysis",
  },
  {
    who: "Literature Surveys",
    what: "Compare 2–4 papers side-by-side to map the state of the field — methodology, experiments, contributions, and limitations in one view.",
    cta: "Compare papers",
  },
];

const FREE_FEATURES = [
  "10 reviews per week",
  "Full 5-reviewer committee",
  "2-round debate with cross-examination",
  "Moderator verdict + action items",
  "arXiv · PDF · URL · text input",
  "Citation coverage map",
  "Markdown export",
];

const PRO_FEATURES = [
  "50 reviews per day",
  "Adversarial debate mode",
  "Multi-paper comparison (2–4)",
  "20 MB PDF · 150-page limit",
  "Chat with paper (RAG Q&A)",
  "Priority compute",
  "Cancel anytime",
];

// ─── Inline SVG icons (16×16, stroke-based) ──────────────────────────────────

function ScalesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

function VerdictRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.softMuted, marginBottom: 5 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, lineHeight: 1.65, color: T.ink }}>{text}</div>
    </div>
  );
}

const iconStyle = { stroke: T.accent, fill: "none", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CritiqueIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" {...iconStyle}><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0 1 14 0v2"/><path d="M16 11l2 2 4-4"/></svg>;
}
function GapIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" {...iconStyle}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
}
function DebateIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" {...iconStyle}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function CompareIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" {...iconStyle}><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>;
}
function MapIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" {...iconStyle}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
}
function ChatIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" {...iconStyle}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function ExportIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" {...iconStyle}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function UploadIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accentMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function LinkIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accentMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function TextIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accentMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>;
}
