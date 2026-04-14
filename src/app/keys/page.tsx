"use client";

import { useState } from "react";

type View = "pricing" | "free-form" | "pro-form" | "free-success";

interface KeyResult {
  id: string;
  key: string;
  name: string;
  tier: string;
  dailyLimit: number;
}

export default function KeysPage() {
  const [view, setView] = useState<View>("pricing");

  // Free form state
  const [freeName, setFreeName] = useState("");
  const [freeEmail, setFreeEmail] = useState("");
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeResult, setFreeResult] = useState<KeyResult | null>(null);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeCopied, setFreeCopied] = useState(false);

  // Pro form state
  const [proName, setProName] = useState("");
  const [proEmail, setProEmail] = useState("");
  const [proLoading, setProLoading] = useState(false);
  const [proError, setProError] = useState<string | null>(null);

  async function handleFreeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFreeError(null);
    setFreeLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: freeName.trim(), email: freeEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFreeError(data.error ?? "Failed to create API key");
        return;
      }
      setFreeResult(data as KeyResult);
      setView("free-success");
    } catch {
      setFreeError("Network error — please try again");
    } finally {
      setFreeLoading(false);
    }
  }

  async function handleFreeCopy() {
    if (!freeResult) return;
    try {
      await navigator.clipboard.writeText(freeResult.key);
      setFreeCopied(true);
      setTimeout(() => setFreeCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function handleProSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProError(null);
    setProLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: proName.trim(), email: proEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setProError(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      setProError("Network error — please try again");
    } finally {
      setProLoading(false);
    }
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
        <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>Council</a>
        <a href="/analyze" style={{
          background: "var(--accent)", color: "#fff",
          padding: "6px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>Start Review</a>
      </nav>

      <div style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "60px 24px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* ── Pricing view ── */}
        {view === "pricing" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                API Access
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6, maxWidth: 420 }}>
                Integrate Council peer review into your research workflow.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, width: "100%" }}>
              {/* Free tier */}
              <PricingCard
                tier="Free"
                price="$0"
                priceNote="forever"
                features={["10 reviews / day", "arXiv + text input", "All reviewer types", "API access"]}
                ctaLabel="Get free key"
                ctaVariant="secondary"
                onCta={() => setView("free-form")}
              />

              {/* Pro tier */}
              <PricingCard
                tier="Pro"
                price="$19"
                priceNote="one-time"
                features={["500 reviews / day", "arXiv + PDF + text", "All reviewer types", "Priority API access", "No expiry"]}
                ctaLabel="Buy Pro — $19"
                ctaVariant="primary"
                badge="BEST VALUE"
                onCta={() => setView("pro-form")}
              />
            </div>

            <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              One-time payment. No subscription. Key never expires.
            </p>
          </>
        )}

        {/* ── Free form ── */}
        {view === "free-form" && (
          <div style={{ width: "100%", maxWidth: 440 }}>
            <button onClick={() => setView("pricing")} style={{
              background: "none", border: "none", color: "var(--text-secondary)",
              fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0,
            }}>← Back</button>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              Get Free API Key
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
              10 reviews per day, forever free.
            </p>
            <form onSubmit={handleFreeSubmit} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 18,
            }}>
              <Field label="Name or project label" required>
                <input
                  type="text"
                  placeholder="e.g. My Research Tool"
                  value={freeName}
                  onChange={(e) => setFreeName(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label="Email" note="optional">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                  style={{ width: "100%" }}
                />
              </Field>
              {freeError && <ErrorBox>{freeError}</ErrorBox>}
              <button
                type="submit"
                disabled={freeLoading || !freeName.trim()}
                style={{
                  background: freeLoading || !freeName.trim() ? "var(--bg-elevated)" : "var(--accent)",
                  color: freeLoading || !freeName.trim() ? "var(--text-muted)" : "#fff",
                  border: "none", borderRadius: 8, padding: "12px 24px",
                  fontSize: 15, fontWeight: 600, cursor: freeLoading || !freeName.trim() ? "not-allowed" : "pointer",
                }}
              >
                {freeLoading ? "Generating…" : "Generate API Key"}
              </button>
            </form>
          </div>
        )}

        {/* ── Free success ── */}
        {view === "free-success" && freeResult && (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 32, display: "flex", flexDirection: "column", gap: 24,
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 48, height: 48, borderRadius: "50%",
                  background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                  marginBottom: 14, fontSize: 22,
                }}>✓</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Key created
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Save it now — it won&apos;t be shown again.
                </p>
              </div>

              <div style={{
                background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 8, padding: "10px 14px", color: "var(--warning)", fontSize: 13, fontWeight: 500,
              }}>
                Copy before closing this page.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Your API key</span>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-accent)",
                  borderRadius: 8, padding: "10px 14px",
                }}>
                  <code style={{ flex: 1, fontSize: 13, color: "var(--accent)", wordBreak: "break-all", fontFamily: "monospace" }}>
                    {freeResult.key}
                  </code>
                  <button
                    onClick={handleFreeCopy}
                    style={{
                      background: freeCopied ? "var(--success)" : "var(--bg-primary)",
                      color: freeCopied ? "#fff" : "var(--text-secondary)",
                      border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px",
                      fontSize: 13, fontWeight: 500, flexShrink: 0, cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    {freeCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div style={{
                background: "var(--bg-elevated)", borderRadius: 8, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <Row label="Plan" value="Free" />
                <Row label="Daily limit" value="10 requests / day" />
                <Row label="Key ID" value={freeResult.id} mono />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => { setView("pro-form"); }}
                  style={{
                    flex: 1, background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: 8, padding: "10px 16px",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Upgrade to Pro — $19
                </button>
                <a href="/" style={{
                  flex: 1, textAlign: "center", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px",
                  fontSize: 14, fontWeight: 500, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  Done
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Pro form ── */}
        {view === "pro-form" && (
          <div style={{ width: "100%", maxWidth: 440 }}>
            <button onClick={() => setView("pricing")} style={{
              background: "none", border: "none", color: "var(--text-secondary)",
              fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0,
            }}>← Back</button>

            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              Buy Pro Access
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
              500 reviews/day. One-time $19. Key never expires.
            </p>

            <form onSubmit={handleProSubmit} style={{
              background: "var(--bg-card)", border: "1px solid var(--border-accent)",
              borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 18,
            }}>
              <Field label="Name or project label" required>
                <input
                  type="text"
                  placeholder="e.g. My Research Tool"
                  value={proName}
                  onChange={(e) => setProName(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label="Email" note="optional — for key recovery">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={proEmail}
                  onChange={(e) => setProEmail(e.target.value)}
                  style={{ width: "100%" }}
                />
              </Field>

              {proError && <ErrorBox>{proError}</ErrorBox>}

              <div style={{
                background: "var(--bg-elevated)", borderRadius: 8, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <Row label="Plan" value="Pro" accent />
                <Row label="Daily limit" value="500 requests / day" />
                <Row label="Price" value="$19 one-time" />
                <Row label="Expiry" value="Never" />
              </div>

              <button
                type="submit"
                disabled={proLoading || !proName.trim()}
                style={{
                  background: proLoading || !proName.trim() ? "var(--bg-elevated)" : "var(--accent)",
                  color: proLoading || !proName.trim() ? "var(--text-muted)" : "#fff",
                  border: "none", borderRadius: 8, padding: "13px 24px",
                  fontSize: 15, fontWeight: 600, cursor: proLoading || !proName.trim() ? "not-allowed" : "pointer",
                }}
              >
                {proLoading ? "Redirecting to Stripe…" : "Continue to payment →"}
              </button>

              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                Secured by Stripe. We never see your card details.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PricingCard({
  tier, price, priceNote, features, ctaLabel, ctaVariant, badge, onCta,
}: {
  tier: string;
  price: string;
  priceNote: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "primary" | "secondary";
  badge?: string;
  onCta: () => void;
}) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${ctaVariant === "primary" ? "var(--border-accent)" : "var(--border)"}`,
      borderRadius: 12, padding: 24,
      display: "flex", flexDirection: "column", gap: 20,
      position: "relative",
    }}>
      {badge && (
        <div style={{
          position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
          background: "var(--accent)", color: "#fff",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          padding: "3px 10px", borderRadius: 20,
        }}>{badge}</div>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>{tier}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>{price}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{priceNote}</span>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f) => (
          <li key={f} style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <button onClick={onCta} style={{
        background: ctaVariant === "primary" ? "var(--accent)" : "transparent",
        color: ctaVariant === "primary" ? "#fff" : "var(--text-primary)",
        border: ctaVariant === "primary" ? "none" : "1px solid var(--border)",
        borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600,
        cursor: "pointer", width: "100%",
        transition: "opacity 150ms ease",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function Field({ label, required, note, children }: {
  label: string; required?: boolean; note?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
        {note && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({note})</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 6, padding: "10px 14px", color: "var(--danger)", fontSize: 14,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        fontSize: mono ? 12 : 13,
        fontWeight: 600,
        color: accent ? "var(--accent)" : "var(--text-primary)",
        fontFamily: mono ? "monospace" : undefined,
        textTransform: accent ? "capitalize" : undefined,
      }}>{value}</span>
    </div>
  );
}
