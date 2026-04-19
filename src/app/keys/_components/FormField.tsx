"use client";

interface FieldProps {
  label: string;
  required?: boolean;
  note?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, required, note, error, children }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
        {note && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({note})</span>}
      </label>
      {children}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 6, padding: "10px 14px", color: "var(--danger)", fontSize: 14,
    }}>
      {children}
    </div>
  );
}

export function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
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
