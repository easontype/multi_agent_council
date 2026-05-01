"use client";

import { useState } from "react";
import { PricingCard } from "./_components/PricingCard";
import { FreeKeyForm } from "./_components/FreeKeyForm";
import { KeySuccess } from "./_components/KeySuccess";
import { ProKeyForm } from "./_components/ProKeyForm";

type View = "pricing" | "free-form" | "pro-form" | "free-success";

interface KeyResult {
  id: string;
  key: string;
  name: string;
  tier: string;
  dailyLimit: number;
}

function validateEmail(email: string) {
  if (!email.trim()) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email address";
}

export default function KeysPage() {
  const [view, setView] = useState<View>("pricing");

  // Free form state
  const [freeName, setFreeName] = useState("");
  const [freeEmail, setFreeEmail] = useState("");
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeResult, setFreeResult] = useState<KeyResult | null>(null);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeFieldErrors, setFreeFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [freeCopied, setFreeCopied] = useState(false);

  // Pro form state
  const [proName, setProName] = useState("");
  const [proEmail, setProEmail] = useState("");
  const [proLoading, setProLoading] = useState(false);
  const [proError, setProError] = useState<string | null>(null);
  const [proFieldErrors, setProFieldErrors] = useState<{ name?: string; email?: string }>({});

  async function handleFreeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFreeError(null);
    const errors: { name?: string; email?: string } = {};
    if (!freeName.trim()) errors.name = "Name or project label is required";
    const emailErr = validateEmail(freeEmail);
    if (emailErr) errors.email = emailErr;
    if (Object.keys(errors).length) { setFreeFieldErrors(errors); return; }
    setFreeFieldErrors({});
    setFreeLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: freeName.trim(), email: freeEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setFreeError(data.error ?? "Failed to create API key"); return; }
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
    const errors: { name?: string; email?: string } = {};
    if (!proName.trim()) errors.name = "Name or project label is required";
    const emailErr = validateEmail(proEmail);
    if (emailErr) errors.email = emailErr;
    if (Object.keys(errors).length) { setProFieldErrors(errors); return; }
    setProFieldErrors({});
    setProLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: proName.trim(), email: proEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setProError(data.error ?? "Failed to start checkout"); return; }
      window.location.href = data.url;
    } catch {
      setProError("Network error — please try again");
    } finally {
      setProLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-primary)",
      ["--accent" as string]: "#111",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <a href="/home" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>Council</a>
        <a href="/review/new" style={{
          background: "var(--accent)", color: "#fff",
          padding: "6px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>Start Review</a>
      </nav>

      <div style={{
        maxWidth: 640, margin: "0 auto",
        padding: "60px 24px 80px",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
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
              <PricingCard
                tier="Free"
                price="$0"
                priceNote="forever"
                features={["10 reviews / day", "arXiv + text input", "All reviewer types", "API access"]}
                ctaLabel="Get free key"
                ctaVariant="secondary"
                onCta={() => setView("free-form")}
              />
              <PricingCard
                tier="Pro"
                price="$20"
                priceNote="/month"
                features={["500 reviews / day", "arXiv + PDF + text", "All reviewer types", "Priority API access", "Cancel anytime"]}
                ctaLabel="Subscribe — $20/mo"
                ctaVariant="primary"
                badge="BEST VALUE"
                onCta={() => setView("pro-form")}
              />
            </div>

            <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Monthly subscription. Cancel anytime from your Stripe dashboard.
            </p>
          </>
        )}

        {view === "free-form" && (
          <FreeKeyForm
            name={freeName}
            email={freeEmail}
            loading={freeLoading}
            error={freeError}
            fieldErrors={freeFieldErrors}
            onNameChange={(v) => { setFreeName(v); setFreeFieldErrors(p => ({ ...p, name: undefined })); }}
            onEmailChange={(v) => { setFreeEmail(v); setFreeFieldErrors(p => ({ ...p, email: undefined })); }}
            onSubmit={handleFreeSubmit}
            onBack={() => setView("pricing")}
          />
        )}

        {view === "free-success" && freeResult && (
          <KeySuccess
            result={freeResult}
            copied={freeCopied}
            onCopy={handleFreeCopy}
            onUpgrade={() => setView("pro-form")}
          />
        )}

        {view === "pro-form" && (
          <ProKeyForm
            name={proName}
            email={proEmail}
            loading={proLoading}
            error={proError}
            fieldErrors={proFieldErrors}
            onNameChange={(v) => { setProName(v); setProFieldErrors(p => ({ ...p, name: undefined })); }}
            onEmailChange={(v) => { setProEmail(v); setProFieldErrors(p => ({ ...p, email: undefined })); }}
            onSubmit={handleProSubmit}
            onBack={() => setView("pricing")}
          />
        )}
      </div>
    </div>
  );
}
