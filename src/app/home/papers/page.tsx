"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface PaperAssetItem {
  id: string;
  canonical_title: string;
  arxiv_id: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  marker_processed: boolean;
  primary_library_id: string | null;
  created_at: string;
  updated_at: string;
  session_count: number;
}

const STATUS_STYLE: Record<PaperAssetItem["status"], { bg: string; text: string; label: string }> = {
  ready: { bg: "#ecfdf5", text: "#166534", label: "Ready" },
  processing: { bg: "#fffbeb", text: "#92400e", label: "Processing" },
  pending: { bg: "#f5f5f4", text: "#57534e", label: "Pending" },
  failed: { bg: "#fef2f2", text: "#b91c1c", label: "Failed" },
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
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PapersPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/papers")
      .then((response) => response.json())
      .then((data: PaperAssetItem[]) => setPapers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return papers;
    return papers.filter((paper) =>
      paper.canonical_title.toLowerCase().includes(normalized)
      || (paper.arxiv_id ?? "").toLowerCase().includes(normalized),
    );
  }, [papers, query]);

  return (
    <div style={{ padding: "40px 48px 60px", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: "#1a1a1a",
          letterSpacing: "-0.04em",
          margin: "0 0 4px",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          Papers
        </h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
          Cached paper assets and the review sessions attached to them
        </p>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
      }}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search papers or arXiv id"
          style={{
            width: 280,
            maxWidth: "100%",
            border: "1px solid #ebebed",
            background: "#fafafa",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            color: "#1a1a1a",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => router.push("/review/new")}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "9px 13px",
            background: "#111827",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          New Review
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "32px 0", color: "#a1a1aa", fontSize: 13 }}>Loading papers...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: "48px 24px",
          border: "1px dashed #ebebed",
          borderRadius: 10,
          textAlign: "center",
          color: "#a1a1aa",
          fontSize: 13,
        }}>
          {query.trim() ? "No papers match this search." : "No cached papers yet."}
        </div>
      ) : (
        <div style={{ border: "1px solid #f0f0f2", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 120px 90px 90px",
            padding: "9px 16px",
            background: "#fafafa",
            borderBottom: "1px solid #f0f0f2",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.07em",
            color: "#bbb",
            textTransform: "uppercase",
          }}>
            <span>Paper</span>
            <span>Status</span>
            <span>Sessions</span>
            <span>Updated</span>
          </div>

          {filtered.map((paper, index) => {
            const status = STATUS_STYLE[paper.status] ?? STATUS_STYLE.pending;
            return (
              <div
                key={paper.id}
                onClick={() => router.push(`/home/papers/${paper.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 120px 90px 90px",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: index < filtered.length - 1 ? "1px solid #f5f5f7" : "none",
                  cursor: "pointer",
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{
                    fontSize: 13,
                    color: "#18181b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: 3,
                  }}>
                    {paper.canonical_title}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#71717a" }}>
                    {paper.arxiv_id ? `arXiv ${paper.arxiv_id}` : paper.primary_library_id ? `Library ${paper.primary_library_id}` : "Local upload"}
                  </div>
                </div>
                <span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 7px",
                    background: status.bg,
                    color: status.text,
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                  }}>
                    {status.label.toUpperCase()}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: "#52525b" }}>{paper.session_count}</span>
                <span style={{ fontSize: 12, color: "#a1a1aa" }}>{timeAgo(paper.updated_at || paper.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
