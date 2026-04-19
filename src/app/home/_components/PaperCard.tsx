"use client";

import { useState } from "react";
import { BookIcon, ExternalIcon } from "./icons";

export interface PaperResult {
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

interface PaperCardProps {
  paper: PaperResult;
  onReview: (p: PaperResult) => void;
}

export function PaperCard({ paper, onReview }: PaperCardProps) {
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
