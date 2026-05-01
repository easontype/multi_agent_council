"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { setPendingUpload } from "@/lib/pending-upload";
import { SearchBar } from "./_components/SearchBar";
import { SearchResults } from "./_components/SearchResults";
import { StatsGrid } from "./_components/StatsGrid";
import { RecentReviews } from "./_components/RecentReviews";
import type { PaperResult } from "./_components/PaperCard";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

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

  // Upload / drag
  const [dragging, setDragging] = useState(false);

  const firstName = (session?.user?.name || session?.user?.email || "Researcher").split(" ")[0];
  const todayCount = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length;
  const concludedCount = sessions.filter(s => s.status === "concluded").length;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  useEffect(() => {
    fetch("/api/sessions")
      .then(r => r.json())
      .then((data: SessionItem[]) => setSessions(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

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
      router.push(`/review/new?arxiv=${encodeURIComponent(paper.arxivId)}`);
    } else {
      router.push("/review/new");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUpload(file);
    router.push("/review/new");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      setPendingUpload(file);
      router.push("/review/new");
    }
  };

  const showResults = query.trim().length > 0;

  const stats = [
    { label: "Total reviews", value: loadingSessions ? "—" : String(sessions.length), sub: "all time" },
    { label: "Today", value: loadingSessions ? "—" : `${todayCount} / 10`, sub: "daily limit" },
    { label: "Concluded", value: loadingSessions ? "—" : String(concludedCount), sub: "completed" },
  ];

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

      <SearchBar
        query={query}
        searching={searching}
        showResults={showResults}
        onQueryChange={handleQueryChange}
        onSubmit={handleSearchSubmit}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        dragging={dragging}
        onDragOver={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
      />

      {showResults ? (
        <SearchResults
          query={query}
          searching={searching}
          results={results}
          searchError={searchError}
          onReview={handleReview}
          onClear={() => { setQuery(""); setResults(null); }}
        />
      ) : (
        <>
          <StatsGrid stats={stats} />
          <RecentReviews
            sessions={sessions}
            loadingSessions={loadingSessions}
            onSessionClick={(session) => router.push(`/review/${encodeURIComponent(session.id)}`)}
          />
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
