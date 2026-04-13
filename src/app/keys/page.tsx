"use client";

import { useState } from "react";

interface KeyResult {
  id: string;
  key: string;
  name: string;
  tier: string;
  dailyLimit: number;
}

export default function KeysPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create API key");
        return;
      }

      setResult(data as KeyResult);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the text manually
    }
  }

  const curlExample = result
    ? `curl -X POST https://YOUR_DOMAIN/api/v1/analyze \\
  -H "Authorization: Bearer ${result.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"arxivId": "2301.07041", "template": "critique", "rounds": 1}'`
    : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Get API Access
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6 }}>
            Generate a free API key to integrate Council peer review into your workflow.
          </p>
        </div>

        {!result ? (
          /* ── Registration form ── */
          <form
            onSubmit={handleSubmit}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="name"
                style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}
              >
                Name or project label <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. My Research Tool"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="email"
                style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}
              >
                Email{" "}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  color: "var(--danger)",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                background: loading || !name.trim() ? "var(--bg-elevated)" : "var(--accent)",
                color: loading || !name.trim() ? "var(--text-muted)" : "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading || !name.trim() ? "not-allowed" : "pointer",
                transition: "background 150ms ease",
              }}
            >
              {loading ? "Generating…" : "Generate API Key"}
            </button>
          </form>
        ) : (
          /* ── Key revealed ── */
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Warning banner */}
            <div
              style={{
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "var(--warning)",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Save this key now — it will not be shown again.
            </div>

            {/* Key display */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                Your API key
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-accent)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--accent)",
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                  }}
                >
                  {result.key}
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
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Plan info */}
            <div
              style={{
                background: "var(--bg-elevated)",
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Plan</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    textTransform: "capitalize",
                  }}
                >
                  {result.tier}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Daily limit
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {result.dailyLimit} requests / day
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Key ID</span>
                <code
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                  }}
                >
                  {result.id}
                </code>
              </div>
            </div>

            {/* Example curl */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                Example request
              </span>
              <pre
                style={{
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
                }}
              >
                {curlExample}
              </pre>
            </div>

            {/* Generate another */}
            <button
              onClick={() => {
                setResult(null);
                setName("");
                setEmail("");
                setError(null);
              }}
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 150ms ease",
              }}
            >
              Generate another key
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
