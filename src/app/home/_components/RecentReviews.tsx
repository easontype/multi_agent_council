"use client";

import { STATUS_DOT, STATUS_LABEL, timeAgo, truncate } from "./utils";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface RecentReviewsProps {
  sessions: SessionItem[];
  loadingSessions: boolean;
  onSessionClick: (session: SessionItem) => void;
}

export function RecentReviews({ sessions, loadingSessions, onSessionClick }: RecentReviewsProps) {
  const recent = sessions.slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#bbb", textTransform: "uppercase" }}>
          Recent Reviews
        </span>
        {sessions.length > 0 && (
          <a href="/home/reviews" style={{ fontSize: 12, color: "#888", textDecoration: "none", fontWeight: 500, transition: "color 150ms" }}
            onMouseEnter={e => e.currentTarget.style.color = "#111"}
            onMouseLeave={e => e.currentTarget.style.color = "#888"}
          >
            View all {sessions.length} →
          </a>
        )}
      </div>

      {loadingSessions ? (
        <div style={{ padding: "20px 0", color: "#ccc", fontSize: 13 }}>Loading…</div>
      ) : recent.length === 0 ? (
        <div style={{
          padding: "32px 20px", border: "1px dashed #ebebed", borderRadius: 10,
          textAlign: "center", color: "#ccc", fontSize: 13, lineHeight: 1.6,
        }}>
          Search for a paper above to start your first review
        </div>
      ) : (
        <div>
          {recent.map((s, i) => (
            <div key={s.id}
              onClick={() => onSessionClick(s)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 10px", borderRadius: 8, cursor: "pointer",
                borderBottom: i < recent.length - 1 ? "1px solid #f5f5f7" : "none",
                transition: "background 120ms",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#fafafa"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: STATUS_DOT[s.status] ?? "#d1d5db",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: "#1a1a1a",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {truncate(s.title.replace(/^Review:\s*/i, ""), 62)}
                </div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{timeAgo(s.created_at)}</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                color: "#999", flexShrink: 0, textTransform: "uppercase",
              }}>
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
            </div>
          ))}

          {sessions.length > 0 && (
            <a href="/home/reviews" style={{
              display: "block", textAlign: "center", marginTop: 14,
              fontSize: 12, color: "#888", textDecoration: "none", fontWeight: 500,
              padding: "9px", border: "1px solid #ebebed", borderRadius: 8,
              transition: "color 150ms, border-color 150ms",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#111"; e.currentTarget.style.borderColor = "#ccc"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#ebebed"; }}
            >
              View all reviews →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
