"use client";

interface StatItem {
  label: string;
  value: string;
  sub: string;
}

interface StatsGridProps {
  stats: StatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
      {stats.map(stat => (
        <div key={stat.label} style={{
          border: "1px solid #f0f0f2", borderRadius: 10,
          padding: "16px 18px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#bbb", textTransform: "uppercase", marginBottom: 8 }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 4, fontFamily: "'Georgia', serif" }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 11, color: "#ccc" }}>{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}
