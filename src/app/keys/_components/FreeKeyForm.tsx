"use client";

import { Field, ErrorBox } from "./FormField";

interface FieldErrors {
  name?: string;
  email?: string;
}

interface FreeKeyFormProps {
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

export function FreeKeyForm({
  name, email, loading, error, fieldErrors,
  onNameChange, onEmailChange, onSubmit, onBack,
}: FreeKeyFormProps) {
  return (
    <div style={{ width: "100%", maxWidth: 440 }}>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0,
      }}>← Back</button>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
        Get Free API Key
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
        10 reviews per day, forever free.
      </p>
      <form onSubmit={onSubmit} style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
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
        <Field label="Email" note="optional" error={fieldErrors.email}>
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
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? "var(--bg-elevated)" : "var(--accent)",
            color: loading ? "var(--text-muted)" : "#fff",
            border: "none", borderRadius: 8, padding: "12px 24px",
            fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate API Key"}
        </button>
      </form>
    </div>
  );
}
