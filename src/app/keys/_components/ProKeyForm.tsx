"use client";

import { Field, ErrorBox, Row } from "./FormField";

interface FieldErrors {
  name?: string;
  email?: string;
}

interface ProKeyFormProps {
  name: string;
  email: string;
  loading: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function ProKeyForm({
  name, email, loading, error, fieldErrors,
  onNameChange, onEmailChange, onSubmit, onBack,
}: ProKeyFormProps) {
  return (
    <div style={{ width: "100%", maxWidth: 440 }}>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0,
      }}>← Back</button>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
        Subscribe to Pro
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
        500 reviews/day. $20/month. Cancel anytime.
      </p>

      <form onSubmit={onSubmit} style={{
        background: "var(--bg-card)", border: "1px solid var(--border-accent)",
        borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 18,
      }}>
        <Field label="Name or project label" required error={fieldErrors.name}>
          <input
            type="text"
            placeholder="e.g. My Research Tool"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              width: "100%",
              outline: "none",
              border: `1px solid ${fieldErrors.name ? "rgba(239,68,68,0.7)" : "var(--border)"}`,
              borderRadius: 6, padding: "9px 12px", fontSize: 14,
              background: fieldErrors.name ? "rgba(239,68,68,0.04)" : "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
        </Field>
        <Field label="Email" note="optional — for key recovery" error={fieldErrors.email}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            style={{
              width: "100%",
              outline: "none",
              border: `1px solid ${fieldErrors.email ? "rgba(239,68,68,0.7)" : "var(--border)"}`,
              borderRadius: 6, padding: "9px 12px", fontSize: 14,
              background: fieldErrors.email ? "rgba(239,68,68,0.04)" : "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div style={{
          background: "var(--bg-elevated)", borderRadius: 8, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <Row label="Plan" value="Pro" accent />
          <Row label="Daily limit" value="500 requests / day" />
          <Row label="Price" value="$20 / month" />
          <Row label="Billing" value="Monthly, cancel anytime" />
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          style={{
            background: loading || !name.trim() ? "var(--bg-elevated)" : "var(--accent)",
            color: loading || !name.trim() ? "var(--text-muted)" : "#fff",
            border: "none", borderRadius: 8, padding: "13px 24px",
            fontSize: 15, fontWeight: 600, cursor: loading || !name.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Redirecting to Stripe…" : "Continue to subscription →"}
        </button>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Secured by Stripe. We never see your card details.
        </p>
      </form>
    </div>
  );
}
