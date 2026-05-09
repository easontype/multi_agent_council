"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PaperCompareTable, type CompareSessionData } from "@/components/council/paper-compare-table";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
  has_veto?: boolean;
  rounds?: number;
  seats?: Array<{ role: string }>;
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

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [query, setQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareView, setCompareView] = useState(false);
  const [comparedSessions, setComparedSessions] = useState<CompareSessionData[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    fetch("/api/sessions")
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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSessions(prev => prev.filter(s => s.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch {
      setDeleteError("Could not delete that review. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleCompareMode() {
    setCompareMode(v => !v);
    setSelectedIds(new Set());
    setCompareView(false);
  }

  function toggleSelect(e: React.MouseEvent, id: string, status: string) {
    if (!compareMode) return;
    e.stopPropagation();
    if (status !== "concluded") return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCompare() {
    if (selectedIds.size < 2) return;
    setCompareLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.all(ids.map(id => fetch(`/api/sessions/${id}`).then(r => r.json())));
      const compared: CompareSessionData[] = results.map((data, i) => {
        const sess = data.session ?? {};
        const conc = data.conclusion ?? null;
        const seats: Array<{ role: string }> = Array.isArray(sess.seats) ? sess.seats : [];
        const isGap = seats.some((s: { role: string }) =>
          ['Gap Finder', 'Hostile Reviewer', 'Methods Auditor', 'Related Work Scout', 'Supportive Mentor'].includes(s.role)
        );
        return {
          id: ids[i]!,
          title: sess.title ?? 'Unknown',
          mode: isGap ? 'gap' : 'critique',
          confidence: (conc?.confidence as CompareSessionData['confidence']) ?? null,
          confidenceReason: conc?.confidence_reason ?? null,
          summary: conc?.summary ?? null,
          consensus: conc?.consensus ?? null,
          veto: conc?.veto ?? null,
          actionItems: Array.isArray(conc?.action_items) ? conc.action_items : [],
          rounds: sess.rounds ?? 1,
          createdAt: sess.created_at ?? '',
        };
      });
      setComparedSessions(compared);
      setCompareView(true);
    } finally {
      setCompareLoading(false);
    }
  }

  // Show comparison table view
  if (compareView && comparedSessions.length > 0) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <PaperCompareTable
          sessions={comparedSessions}
          onClose={() => setCompareView(false)}
          onOpenSession={(id) => router.push(`/review/${encodeURIComponent(id)}`)}
        />
      </div>
    );
  }

  const selectedCount = selectedIds.size;
  const concludedCount = sessions.filter(s => s.status === "concluded").length;

  return (
    <div style={{ padding: "40px 48px 80px", maxWidth: 860, margin: "0 auto", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
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
        {concludedCount >= 2 && (
          <button
            onClick={toggleCompareMode}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${compareMode ? "#111827" : "#e4e4e7"}`,
              background: compareMode ? "#111827" : "#fff",
              color: compareMode ? "#fff" : "#52525b",
              cursor: "pointer", transition: "all 120ms",
              marginTop: 2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            {compareMode ? "Exit Compare" : "Compare Papers"}
          </button>
        )}
      </div>

      {compareMode && (
        <div style={{
          marginBottom: 16, padding: "9px 14px",
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
          fontSize: 12, color: "#92400e",
        }}>
          Select 2–4 concluded reviews to compare. {concludedCount < 2 && "You need at least 2 concluded reviews."}
          {concludedCount >= 2 && `${selectedCount} selected${selectedCount > 0 ? ` — click a row to ${selectedIds.size > 0 ? 'add or remove' : 'select'}` : " — click concluded rows to select"}.`}
        </div>
      )}

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

        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "concluded", "running", "pending", "failed"] as FilterStatus[]).map(f => {
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

      {deleteError && (
        <div role="alert" style={{
          marginBottom: 14, border: "1px solid #fecaca", borderRadius: 8,
          background: "#fef2f2", color: "#b91c1c", fontSize: 12, padding: "8px 10px",
        }}>
          {deleteError}
        </div>
      )}

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
          <div style={{
            display: "grid",
            gridTemplateColumns: compareMode ? "28px 1fr 110px 80px 48px" : "1fr 110px 80px 48px",
            padding: "9px 16px", background: "#fafafa",
            borderBottom: "1px solid #f0f0f2",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
            color: "#bbb", textTransform: "uppercase",
          }}>
            {compareMode && <span />}
            <span>Title</span>
            <span>Status</span>
            <span>When</span>
            <span />
          </div>

          {filtered.map((s, i) => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
            const isHovered = hoveredId === s.id;
            const isDeleting = deletingId === s.id;
            const isSelected = selectedIds.has(s.id);
            const isSelectableInCompare = compareMode && s.status === "concluded";
            const isDisabledInCompare = compareMode && s.status !== "concluded";

            return (
              <div
                key={s.id}
                onClick={(e) => {
                  if (compareMode) {
                    toggleSelect(e, s.id, s.status);
                  } else {
                    router.push(`/review/${encodeURIComponent(s.id)}`);
                  }
                }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: compareMode ? "28px 1fr 110px 80px 48px" : "1fr 110px 80px 48px",
                  alignItems: "center", padding: "11px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f5f5f7" : "none",
                  cursor: isDisabledInCompare ? "default" : "pointer",
                  transition: "background 120ms",
                  background: isSelected
                    ? "#f0f9ff"
                    : isHovered && !isDisabledInCompare
                      ? "#fafafa"
                      : "transparent",
                  opacity: isDisabledInCompare ? 0.5 : 1,
                  borderLeft: isSelected ? "2px solid #3b82f6" : compareMode ? "2px solid transparent" : "none",
                }}
              >
                {compareMode && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `1.5px solid ${isSelected ? "#3b82f6" : isSelectableInCompare ? "#d4d4d8" : "#e4e4e7"}`,
                      background: isSelected ? "#3b82f6" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff",
                    }}>
                      {isSelected && <CheckIcon />}
                    </span>
                  </div>
                )}

                {/* Title */}
                <div style={{ overflow: "hidden", paddingRight: 16 }}>
                  <div style={{
                    fontSize: 13, color: "#1a1a1a",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {truncate(s.title.replace(/^Review:\s*/i, ""), 64)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    {s.rounds && (
                      <span style={{ fontSize: 10, color: "#bbb" }}>
                        {s.rounds} round{s.rounds !== 1 ? "s" : ""}
                      </span>
                    )}
                    {s.has_veto && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                        color: "#b91c1c", background: "#fef2f2",
                        border: "1px solid #fecaca", borderRadius: 3, padding: "1px 5px",
                      }}>
                        VETO
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px",
                    background: cfg.bg, color: cfg.text,
                    borderRadius: 4, letterSpacing: "0.04em",
                  }}>
                    {cfg.label.toUpperCase()}
                  </span>
                </span>

                {/* Time */}
                <span style={{ fontSize: 12, color: "#bbb" }}>{timeAgo(s.created_at)}</span>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  {!compareMode && isHovered && !isDeleting ? (
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      aria-label={`Delete ${s.title.replace(/^Review:\s*/i, "")}`}
                      title="Delete review"
                      disabled={isDeleting}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#d4d4d8", padding: 4, borderRadius: 5,
                        display: "flex", alignItems: "center", transition: "color 120ms",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444" }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#d4d4d8" }}
                    >
                      <TrashIcon />
                    </button>
                  ) : !compareMode && isDeleting ? (
                    <span style={{
                      width: 13, height: 13, border: "1.5px solid #d4d4d8",
                      borderTopColor: "#888", borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }} />
                  ) : !compareMode ? (
                    <span style={{ color: "#e5e7eb", display: "flex" }}><ExternalIcon /></span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky compare bar */}
      {compareMode && selectedCount > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 12,
          background: "#111827", borderRadius: 12,
          padding: "12px 20px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
          zIndex: 50,
          animation: "bar-in 200ms ease both",
        }}>
          <span style={{ fontSize: 12, color: "#d1d5db" }}>
            {selectedCount} paper{selectedCount !== 1 ? "s" : ""} selected
            {selectedCount < 2 && " — select one more"}
          </span>
          <button
            onClick={handleCompare}
            disabled={selectedCount < 2 || compareLoading}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: selectedCount >= 2 ? "#fff" : "#374151",
              color: selectedCount >= 2 ? "#111827" : "#9ca3af",
              border: "none", cursor: selectedCount >= 2 ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 120ms",
            }}
          >
            {compareLoading ? (
              <>
                <span style={{
                  width: 10, height: 10, border: "1.5px solid #6b7280",
                  borderTopColor: "#111827", borderRadius: "50%",
                  display: "inline-block", animation: "spin 0.7s linear infinite",
                }} />
                Loading…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                Compare {selectedCount} papers
              </>
            )}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9ca3af", fontSize: 11, padding: "4px 6px",
              transition: "color 100ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af" }}
          >
            Clear
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bar-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
}
