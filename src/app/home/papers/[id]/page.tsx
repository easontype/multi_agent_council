"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface PaperAsset {
  id: string;
  canonical_title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  arxiv_id: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  marker_processed: boolean;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionSummary {
  id: string;
  title: string;
  topic: string;
  status: string;
  rounds: number;
  divergence_level: string | null;
  created_at: string;
  concluded_at: string | null;
}

interface PaperDetail {
  asset: PaperAsset;
  sessions: SessionSummary[];
}

const PAPER_STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ready:      { bg: "#ecfdf5", text: "#166534", label: "Ready" },
  processing: { bg: "#fffbeb", text: "#92400e", label: "Processing" },
  pending:    { bg: "#f5f5f4", text: "#57534e", label: "Pending" },
  failed:     { bg: "#fef2f2", text: "#b91c1c", label: "Failed" },
};

const SESSION_STATUS_STYLE: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  concluded: { dot: "#22c55e", bg: "#f0fdf4", text: "#15803d", label: "Concluded" },
  running:   { dot: "#a78bfa", bg: "#faf5ff", text: "#7c3aed", label: "Running" },
  pending:   { dot: "#f59e0b", bg: "#fffbeb", text: "#b45309", label: "Pending" },
  failed:    { dot: "#ef4444", bg: "#fef2f2", text: "#b91c1c", label: "Failed" },
};

const DIVERGENCE_LABEL: Record<string, string> = {
  none: "—", low: "Low", moderate: "Moderate", high: "High",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
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

export default function PaperDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/papers/${params.id}`)
      .then((res) => {
        if (res.status === 404) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data: PaperDetail | null) => { if (data) setDetail(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function handleRetry() {
    if (!params.id || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/papers/${params.id}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setRetryError(body.error ?? "Retry failed");
      } else {
        setLoading(true);
        loadDetail();
      }
    } catch {
      setRetryError("Network error, please try again.");
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 48px", color: "#a1a1aa", fontSize: 13 }}>
        Loading paper…
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div style={{ padding: "40px 48px" }}>
        <button
          type="button"
          onClick={() => router.push("/home/papers")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#71717a", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 24 }}
        >
          <ChevronLeftIcon /> Papers
        </button>
        <p style={{ fontSize: 14, color: "#52525b" }}>Paper not found.</p>
      </div>
    );
  }

  const { asset, sessions } = detail;
  const paperStatus = PAPER_STATUS_STYLE[asset.status] ?? PAPER_STATUS_STYLE.pending;
  const newReviewHref = asset.arxiv_id
    ? `/review/new?arxiv=${encodeURIComponent(asset.arxiv_id)}`
    : "/review/new";

  return (
    <div style={{ padding: "40px 48px 72px", maxWidth: 920, margin: "0 auto" }}>

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/home/papers")}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#71717a", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 24 }}
      >
        <ChevronLeftIcon /> Papers
      </button>

      {/* Paper header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#1a1a1a",
            letterSpacing: "-0.03em",
            margin: 0,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            lineHeight: 1.25,
            flex: "1 1 300px",
          }}>
            {asset.canonical_title}
          </h1>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 7px",
            background: paperStatus.bg,
            color: paperStatus.text,
            borderRadius: 4,
            letterSpacing: "0.05em",
          }}>
            {paperStatus.label.toUpperCase()}
          </span>

          {asset.arxiv_id && (
            <a
              href={`https://arxiv.org/abs/${asset.arxiv_id}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#52525b", textDecoration: "none" }}
            >
              arXiv {asset.arxiv_id} <ExternalIcon />
            </a>
          )}

          {asset.marker_processed && (
            <span style={{ fontSize: 11, color: "#a1a1aa" }}>Full-text indexed</span>
          )}

          {asset.year && (
            <span style={{ fontSize: 12, color: "#a1a1aa" }}>{asset.year}</span>
          )}
        </div>

        {asset.authors.length > 0 && (
          <p style={{ fontSize: 12.5, color: "#71717a", margin: "0 0 10px" }}>
            {asset.authors.join(", ")}
          </p>
        )}

        {asset.abstract && (
          <p style={{
            fontSize: 13,
            color: "#52525b",
            lineHeight: 1.65,
            margin: 0,
            maxWidth: 740,
            borderLeft: "2px solid #e5e7eb",
            paddingLeft: 12,
          }}>
            {asset.abstract.length > 600 ? asset.abstract.slice(0, 600) + "…" : asset.abstract}
          </p>
        )}

        {asset.status === "failed" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ padding: "10px 12px", background: "#fef2f2", borderRadius: 6, fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
              {asset.processing_error
                ? `Processing error: ${asset.processing_error}`
                : "Processing failed."}
            </div>
            {asset.arxiv_id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  style={{
                    border: "1px solid #fca5a5",
                    borderRadius: 6,
                    padding: "6px 12px",
                    background: retrying ? "#fef2f2" : "#fff",
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: retrying ? "not-allowed" : "pointer",
                    opacity: retrying ? 0.7 : 1,
                  }}
                >
                  {retrying ? "Retrying…" : "Retry Ingest"}
                </button>
                {retryError && (
                  <span style={{ fontSize: 12, color: "#b91c1c" }}>{retryError}</span>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
                Re-upload the PDF to retry processing.
              </p>
            )}
          </div>
        )}

        {(asset.status === "processing" || asset.status === "pending") && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", borderRadius: 6, fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
            {asset.status === "processing" ? "Processing in progress…" : "Queued for processing."}
            {asset.arxiv_id && asset.status === "pending" && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                style={{ marginLeft: 4, background: "none", border: "none", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: retrying ? "not-allowed" : "pointer", padding: 0, textDecoration: "underline" }}
              >
                {retrying ? "Retrying…" : "Retry now"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sessions section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
          Review Sessions
          {sessions.length > 0 && (
            <span style={{ fontWeight: 400, color: "#a1a1aa", marginLeft: 6 }}>{sessions.length}</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => router.push(newReviewHref)}
          style={{
            border: "none",
            borderRadius: 7,
            padding: "8px 12px",
            background: "#111827",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}
        >
          New Review
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={{
          padding: "40px 24px",
          border: "1px dashed #ebebed",
          borderRadius: 10,
          textAlign: "center",
          color: "#a1a1aa",
          fontSize: 13,
        }}>
          No review sessions yet.{" "}
          <button
            type="button"
            onClick={() => router.push(newReviewHref)}
            style={{ background: "none", border: "none", color: "#52525b", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            Start the first one.
          </button>
        </div>
      ) : (
        <div style={{ border: "1px solid #f0f0f2", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 100px 80px 80px 72px",
            padding: "8px 16px",
            background: "#fafafa",
            borderBottom: "1px solid #f0f0f2",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.07em",
            color: "#bbb",
            textTransform: "uppercase",
          }}>
            <span>Topic</span>
            <span>Status</span>
            <span>Divergence</span>
            <span>Rounds</span>
            <span>When</span>
          </div>

          {sessions.map((session, index) => {
            const ss = SESSION_STATUS_STYLE[session.status] ?? SESSION_STATUS_STYLE.pending;
            const divLabel = session.divergence_level ? (DIVERGENCE_LABEL[session.divergence_level] ?? session.divergence_level) : "—";
            const divColor = session.divergence_level === "high" ? "#b91c1c"
              : session.divergence_level === "moderate" ? "#92400e"
              : "#a1a1aa";

            return (
              <div
                key={session.id}
                onClick={() => router.push(`/review/${session.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 100px 80px 80px 72px",
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: index < sessions.length - 1 ? "1px solid #f5f5f7" : "none",
                  cursor: "pointer",
                  background: "#fff",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
              >
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{
                    fontSize: 13,
                    color: "#18181b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: session.title && session.title !== session.topic ? 2 : 0,
                  }}>
                    {session.topic || session.title || "Untitled"}
                  </div>
                  {session.title && session.title !== session.topic && (
                    <div style={{ fontSize: 11.5, color: "#71717a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {session.title}
                    </div>
                  )}
                </div>

                <span>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 7px",
                    background: ss.bg,
                    color: ss.text,
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                    {ss.label.toUpperCase()}
                  </span>
                </span>

                <span style={{ fontSize: 12, color: divColor }}>{divLabel}</span>
                <span style={{ fontSize: 12, color: "#52525b" }}>{session.rounds}</span>
                <span style={{ fontSize: 12, color: "#a1a1aa" }}>{timeAgo(session.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#d4d4d8", marginTop: 20, textAlign: "right" }}>
        Paper cached {timeAgo(asset.created_at)}
      </p>
    </div>
  );
}
