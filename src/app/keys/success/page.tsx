"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface KeyData {
  id: string;
  key: string;
  name: string;
  tier: string;
  dailyLimit: number;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session ID. Please contact support.");
      setLoading(false);
      return;
    }

    fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setKeyData(data as KeyData);
        }
      })
      .catch(() => setError("Network error — please refresh once or contact support."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleCopy() {
    if (!keyData) return;
    try {
      await navigator.clipboard.writeText(keyData.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const curlExample = keyData
    ? `curl -X POST https://YOUR_DOMAIN/api/public/v1/analyze \\
  -H "Authorization: Bearer ${keyData.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"arxivId": "2301.07041", "template": "critique", "rounds": 2}'`
    : "";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      ["--accent" as string]: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
    }}>
      {/* Nav */}
      <nav style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        background: "var(--bg-primary)",
        zIndex: 10,
      }}>
        <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>Council</a>
      </nav>

      <div style={{ width: "100%", maxWidth: 540, marginTop: 56 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "80px 0" }}>
            Verifying payment…
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
              Something went wrong
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 24 }}>{error}</p>
            <a href="/keys" style={{
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}>Back to API Keys</a>
          </div>
        )}

        {!loading && keyData && (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}>
            {/* Success header */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56, height: 56,
                borderRadius: "50%",
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.3)",
                marginBottom: 16,
                fontSize: 26,
              }}>✓</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                Subscription activated
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6 }}>
                Your Pro API key is ready. Save it now — it won&apos;t be shown again.
              </p>
            </div>

            {/* Warning */}
            <div style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: 8,
              padding: "12px 16px",
              color: "var(--warning)",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.5,
            }}>
              This key is shown once. Copy it before closing this page.
            </div>

            {/* Key display */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                Your API key
              </span>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-accent)",
                borderRadius: 8,
                padding: "10px 14px",
              }}>
                <code style={{
                  flex: 1,
                  fontSize: 13,
                  color: "var(--accent)",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}>
                  {keyData.key}
                </code>
                <button
                  onClick={handleCopy}
                  style={{
                    background: copied ? "var(--success)" : "var(--bg-primary)",
                    color: copied ? "#fff" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    flexShrink: 0,
                    transition: "all 150ms ease",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Plan info */}
            <div style={{
              background: "var(--bg-elevated)",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Plan</span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: "var(--accent)",
                  textTransform: "capitalize",
                }}>Pro</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Daily limit</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  500 requests / day
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Key ID</span>
                <code style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {keyData.id}
                </code>
              </div>
            </div>

            {/* Example curl */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                Example request
              </span>
              <pre style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "14px 16px",
                fontSize: 12,
                color: "var(--text-secondary)",
                overflowX: "auto",
                fontFamily: "monospace",
                lineHeight: 1.7,
                whiteSpace: "pre",
              }}>
                {curlExample}
              </pre>
            </div>

            <a href="/" style={{
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
            }}>
              Back to Council
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-secondary)" }}>Loading…</span>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
