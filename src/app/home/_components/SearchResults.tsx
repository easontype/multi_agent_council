"use client";

import { SpinnerIcon } from "./icons";
import { PaperCard, PaperResult } from "./PaperCard";

interface SearchResultsProps {
  query: string;
  searching: boolean;
  results: PaperResult[] | null;
  searchError: string | null;
  onReview: (p: PaperResult) => void;
  onClear: () => void;
}

export function SearchResults({
  query,
  searching,
  results,
  searchError,
  onReview,
  onClear,
}: SearchResultsProps) {
  return (
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
            <button onClick={onClear} style={{
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
                <PaperCard key={i} paper={p} onReview={onReview} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
