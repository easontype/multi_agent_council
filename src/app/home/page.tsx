"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { setPendingUpload } from "@/lib/pending-upload";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface PaperResult {
  title: string;
  abstract: string;
  year: number | null;
  authors: string[];
  arxivId: string | null;
  doi: string | null;
  pdfUrl: string | null;
  citationCount: number | null;
  source: "openalex" | "semantic_scholar" | "arxiv";
}

const STATUS_DOT: Record<string, string> = {
  concluded: "#22c55e",
  running: "#a78bfa",
  pending: "#f59e0b",
  failed: "#ef4444",
};

const STATUS_LABEL: Record<string, string> = {
  concluded: "Concluded",
  running: "Running",
  pending: "Pending",
  failed: "Failed",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite", display: "block" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

// ── Paper result card ─────────────────────────────────────────────────────────

function PaperCard({ paper, onReview }: { paper: PaperResult; onReview: (p: PaperResult) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasAbstract = paper.abstract.length > 0;
  const shortAbstract = paper.abstract.slice(0, 220);
  const needsExpand = paper.abstract.length > 220;

  return (
    <div style={{
      padding: "18px 0",
      borderBottom: "1px solid #f0f0f2",
    }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <h3 style={{
          flex: 1, margin: 0,
          fontSize: 14.5, fontWeight: 700, lineHeight: 1.45,
          color: "#1a1a1a", letterSpacing: "-0.02em",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          {paper.title}
        </h3>
        {/* Source badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          color: "#bbb", background: "#f5f5f7",
          padding: "2px 6px", borderRadius: 3, flexShrink: 0,
          textTransform: "uppercase", alignSelf: "flex-start", marginTop: 2,
        }}>
          {paper.source === "arxiv" ? "arXiv" : paper.source === "openalex" ? "OA" : "S2"}
        </span>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: hasAbstract ? 8 : 0, flexWrap: "wrap" }}>
        {paper.authors.length > 0 && (
          <span style={{ fontSize: 12, color: "#888" }}>
            {paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""}
          </span>
        )}
        {paper.year && (
          <span style={{ fontSize: 12, color: "#bbb", fontVariantNumeric: "tabular-nums" }}>{paper.year}</span>
        )}
        {paper.citationCount !== null && paper.citationCount > 0 && (
          <span style={{ fontSize: 12, color: "#bbb" }}>
            {paper.citationCount.toLocaleString()} citations
          </span>
        )}
        {paper.arxivId && (
          <a
            href={`https://arxiv.org/abs/${paper.arxivId}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#bbb", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, transition: "color 150ms" }}
            onMouseEnter={e => e.currentTarget.style.color = "#333"}
            onMouseLeave={e => e.currentTarget.style.color = "#bbb"}
          >
            {paper.arxivId} <ExternalIcon />
          </a>
        )}
      </div>

      {/* Abstract */}
      {hasAbstract && (
        <p style={{
          fontSize: 12.5, color: "#666", lineHeight: 1.65,
          margin: "0 0 10px", fontStyle: "italic",
        }}>
          {expanded ? paper.abstract : shortAbstract}
          {needsExpand && !expanded && "…"}
          {needsExpand && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#bbb", fontSize: 11, fontWeight: 500, padding: "0 0 0 4px",
              transition: "color 150ms",
            }}
              onMouseEnter={e => e.currentTarget.style.color = "#555"}
              onMouseLeave={e => e.currentTarget.style.color = "#bbb"}
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => onReview(paper)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", background: "#111", color: "#fff",
            border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "background 150ms",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#333"}
          onMouseLeave={e => e.currentTarget.style.background = "#111"}
        >
          <BookIcon /> Start Review
        </button>

        {paper.pdfUrl && (
          <a
            href={paper.pdfUrl}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", background: "transparent",
              border: "1px solid #ebebed", borderRadius: 7,
              fontSize: 12, fontWeight: 500, color: "#666",
              textDecoration: "none", transition: "border-color 150ms, color 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ccc"; e.currentTarget.style.color = "#111"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ebebed"; e.currentTarget.style.color = "#666"; }}
          >
            PDF <ExternalIcon />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [greeting, setGreeting] = useState("Hello");

  // Search state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PaperResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const firstName = (session?.user?.name || session?.user?.email || "Researcher").split(" ")[0];
  const todayCount = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length;
  const concludedCount = sessions.filter(s => s.status === "concluded").length;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  useEffect(() => {
    fetch("/api/council")
      .then(r => r.json())
      .then((data: SessionItem[]) => setSessions(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults(null); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    fetch(`/api/search/papers?q=${encodeURIComponent(q.trim())}&limit=8`)
      .then(r => r.json())
      .then((data: PaperResult[]) => setResults(data))
      .catch(() => setSearchError("Search failed — check your connection"))
      .finally(() => setSearching(false));
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!v.trim()) { setResults(null); setSearchError(null); return; }
    searchTimeout.current = setTimeout(() => doSearch(v), 480);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    doSearch(query);
  };

  const handleReview = (paper: PaperResult) => {
    if (paper.arxivId) {
      router.push(`/analyze?arxiv=${encodeURIComponent(paper.arxivId)}`);
    } else {
      router.push("/analyze");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUpload(file);
    router.push("/analyze?tab=upload");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      setPendingUpload(file);
      router.push("/analyze?tab=upload");
    }
  };

  const showResults = query.trim().length > 0;
  const recent = sessions.slice(0, 5);

  return (
    <div style={{
      padding: "40px 48px 60px", maxWidth: 820, margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "#1a1a1a",
          letterSpacing: "-0.04em", marginBottom: 4,
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
          {loadingSessions ? "Loading…" : todayCount > 0 ? `${todayCount} review${todayCount > 1 ? "s" : ""} today` : "No reviews yet today"}
        </p>
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: 32 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: dragging ? "#f5f5f7" : "#fff",
            border: `1.5px solid ${dragging ? "#555" : showResults ? "#333" : "#e0e0e4"}`,
            borderRadius: 12, padding: "6px 8px 6px 16px",
            boxShadow: showResults
              ? "0 2px 12px rgba(0,0,0,0.08)"
              : "0 1px 3px rgba(0,0,0,0.04)",
            transition: "border-color 150ms, box-shadow 200ms",
          }}
        >
          <span style={{ color: "#ccc", display: "flex", flexShrink: 0 }}>
            <SearchIcon size={15} />
          </span>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search papers, paste arXiv ID or DOI…"
            style={{
              flex: 1, background: "transparent", border: "none",
              outline: "none", fontSize: 14, color: "#1a1a1a",
              padding: "8px 0",
            }}
          />
          {/* Upload PDF */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload PDF"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#ccc", padding: "7px", borderRadius: 6, display: "flex",
              transition: "color 150ms",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#555"}
            onMouseLeave={e => e.currentTarget.style.color = "#ccc"}
          >
            <UploadIcon />
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={handleFileChange} />

          {/* Search / go button */}
          <button
            type="submit"
            style={{
              width: 34, height: 34,
              background: query.trim() ? "#111" : "#f0f0f0",
              border: "none", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: query.trim() ? "pointer" : "default",
              transition: "background 150ms", flexShrink: 0,
              color: query.trim() ? "#fff" : "#bbb",
            }}
            onMouseEnter={e => { if (query.trim()) e.currentTarget.style.background = "#333"; }}
            onMouseLeave={e => { if (query.trim()) e.currentTarget.style.background = "#111"; }}
          >
            {searching ? <SpinnerIcon /> : <ArrowIcon />}
          </button>
        </div>
        {dragging && (
          <p style={{ fontSize: 12, color: "#555", marginTop: 6, fontWeight: 500, paddingLeft: 4 }}>Drop PDF to start review</p>
        )}
      </form>

      {/* ── Search results ── */}
      {showResults && (
        <div style={{ marginBottom: 40 }}>
          {searching && results === null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#bbb", fontSize: 13, padding: "12px 0" }}>
              <SpinnerIcon /> Searching…
            </div>
          )}
          {searchError && (
            <div style={{ fontSize: 13, color: "#ef4444", padding: "12px 0" }}>{searchError}</div>
          )}
          {results !== null && !searching && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#bbb", textTransform: "uppercase" }}>
                  {results.length === 0 ? "No results" : `${results.length} results`}
                </span>
                <button onClick={() => { setQuery(""); setResults(null); }} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "#bbb", transition: "color 150ms",
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "#555"}
                  onMouseLeave={e => e.currentTarget.style.color = "#bbb"}
                >
                  Clear
                </button>
              </div>

              {results.length === 0 ? (
                <div style={{
                  padding: "32px 0", textAlign: "center",
                  color: "#ccc", fontSize: 13,
                }}>
                  No papers found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div>
                  {results.map((p, i) => (
                    <PaperCard key={i} paper={p} onReview={handleReview} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Idle state: Stats + Recent ── */}
      {!showResults && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
            {[
              { label: "Total reviews", value: loadingSessions ? "—" : String(sessions.length), sub: "all time" },
              { label: "Today", value: loadingSessions ? "—" : `${todayCount} / 10`, sub: "daily limit" },
              { label: "Concluded", value: loadingSessions ? "—" : String(concludedCount), sub: "completed" },
            ].map(stat => (
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

          {/* Recent reviews */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#bbb", textTransform: "uppercase" }}>
                Recent Reviews
              </span>
              {sessions.length > 5 && (
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
                    onClick={() => router.push("/analyze")}
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

                {sessions.length > 5 && (
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
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
