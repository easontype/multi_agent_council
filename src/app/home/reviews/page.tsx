"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  concluded: { dot: "#22c55e", label: "Concluded", bg: "#f0fdf4", text: "#15803d" },
  running:   { dot: "#a78bfa", label: "Running",   bg: "#faf5ff", text: "#7c3aed" },
  pending:   { dot: "#f59e0b", label: "Pending",   bg: "#fffbeb", text: "#b45309" },
  failed:    { dot: "#ef4444", label: "Failed",    bg: "#fef2f2", text: "#b91c1c" },
};

type FilterStatus = "all" | "concluded" | "running" | "pending" | "failed";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/council")
      .then(r => r.json())
      .then((data: SessionItem[]) => setSessions(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
    if (query && !s.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: sessions.length,
    concluded: sessions.filter(s => s.status === "concluded").length,
    running: sessions.filter(s => s.status === "running").length,
    pending: sessions.filter(s => s.status === "pending").length,
    failed: sessions.filter(s => s.status === "failed").length,
  };

  return (
    <div style={{ padding: "40px 48px 60px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 24, fontWeight: 800, color: "#1a1a1a",
          letterSpacing: "-0.04em", margin: "0 0 4px",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          Reviews
        </h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
          {sessions.length} total review{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "#fafafa", border: "1px solid #ebebed", borderRadius: 8,
          padding: "0 12px", maxWidth: 320,
        }}>
          <span style={{ color: "#ccc", display: "flex" }}><SearchIcon /></span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search reviews…"
            style={{
              background: "transparent", border: "none", outline: "none",
              fontSize: 13, color: "#1a1a1a", padding: "8px 0", flex: 1,
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "concluded", "running", "pending"] as FilterStatus[]).map(f => {
            const active = filter === f;
            const cfg = f === "all" ? null : STATUS_CONFIG[f];
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: `1px solid ${active ? "#ccc" : "#ebebed"}`,
                background: active ? "#f0f0f2" : "transparent",
                color: active ? "#1a1a1a" : "#999",
                cursor: "pointer", transition: "all 150ms",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {cfg && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />}
                {f === "all" ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "32px 0", color: "#ccc", fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: "48px 24px", border: "1px dashed #ebebed", borderRadius: 10,
          textAlign: "center", color: "#ccc", fontSize: 13,
        }}>
          {query || filter !== "all" ? "No reviews match this filter" : "No reviews yet — start one from the dashboard"}
        </div>
      ) : (
        <div style={{ border: "1px solid #f0f0f2", borderRadius: 10, overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 100px 80px 28px",
            padding: "9px 16px", background: "#fafafa",
            borderBottom: "1px solid #f0f0f2",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
            color: "#bbb", textTransform: "uppercase",
          }}>
            <span>Title</span>
            <span>Status</span>
            <span>When</span>
            <span />
          </div>

          {filtered.map((s, i) => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
            return (
              <div key={s.id}
                onClick={() => router.push("/analyze")}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 80px 28px",
                  alignItems: "center", padding: "11px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f5f5f7" : "none",
                  cursor: "pointer", transition: "background 120ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#fafafa" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent" }}
              >
                <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 16 }}>
                  {truncate(s.title.replace(/^Review:\s*/i, ""), 64)}
                </span>
                <span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px",
                    background: cfg.bg, color: cfg.text,
                    borderRadius: 4, letterSpacing: "0.04em",
                  }}>
                    {cfg.label.toUpperCase()}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: "#bbb" }}>{timeAgo(s.created_at)}</span>
                <span style={{ color: "#ddd", display: "flex" }}><ExternalIcon /></span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
