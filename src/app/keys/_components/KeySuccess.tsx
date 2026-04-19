"use client";

import { Row } from "./FormField";

interface KeyResult {
  id: string;
  key: string;
  name: string;
  tier: string;
  dailyLimit: number;
}

interface KeySuccessProps {
  result: KeyResult;
  copied: boolean;
  onCopy: () => void;
  onUpgrade: () => void;
}

export function KeySuccess({ result, copied, onCopy, onUpgrade }: KeySuccessProps) {
  return (
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
              {result.key}
            </code>
            <button
              onClick={onCopy}
              style={{
                background: copied ? "var(--success)" : "var(--bg-primary)",
                color: copied ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px",
                fontSize: 13, fontWeight: 500, flexShrink: 0, cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div style={{
          background: "var(--bg-elevated)", borderRadius: 8, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <Row label="Plan" value="Free" />
          <Row label="Daily limit" value="10 requests / day" />
          <Row label="Key ID" value={result.id} mono />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onUpgrade}
            style={{
              flex: 1, background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 8, padding: "10px 16px",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Upgrade to Pro — $20/mo
          </button>
          <a href="/home" style={{
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
  );
}
