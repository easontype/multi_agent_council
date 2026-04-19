"use client";

interface PricingCardProps {
  tier: string;
  price: string;
  priceNote: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "primary" | "secondary";
  badge?: string;
  onCta: () => void;
}

export function PricingCard({
  tier, price, priceNote, features, ctaLabel, ctaVariant, badge, onCta,
}: PricingCardProps) {
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
