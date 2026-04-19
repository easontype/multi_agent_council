"use client";

import { useRef } from "react";
import { SearchIcon, UploadIcon, ArrowIcon, SpinnerIcon } from "./icons";

interface SearchBarProps {
  query: string;
  searching: boolean;
  showResults: boolean;
  onQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  dragging: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
}

export function SearchBar({
  query,
  searching,
  showResults,
  onQueryChange,
  onSubmit,
  onFileChange,
  onDrop,
  dragging,
  onDragOver,
  onDragLeave,
}: SearchBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 32 }}>
      <div
        onDragOver={e => { e.preventDefault(); onDragOver(); }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
          onChange={onQueryChange}
          placeholder="Search papers, paste arXiv ID or DOI…"
          style={{
            flex: 1, background: "transparent", border: "none",
            outline: "none", fontSize: 14, color: "#1a1a1a",
            padding: "8px 0",
          }}
        />
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
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={onFileChange} />

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
  );
}
