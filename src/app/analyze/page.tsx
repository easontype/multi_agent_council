"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildAcademicCritiqueSeats, buildGapAnalysisSeats } from "@/lib/council-academic";

const MODELS = [
  { value: "codex/codex", label: "Codex (free tier)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (faster)" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6 (best)" },
];

const TEMPLATES = [
  { value: "critique", label: "Full Critique", description: "5 seats: methods, literature, replication, contribution, advocate" },
  { value: "gap", label: "Gap Analysis", description: "5 seats: gap finder, hostile reviewer, methods auditor, related work scout, mentor" },
];

function AnalyzeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialArxiv = searchParams.get("arxiv") ?? "";
  const initialMode = searchParams.get("mode") === "gap" ? "gap" : "critique";
  const [activeTab, setActiveTab] = useState<"arxiv" | "upload">("arxiv");
  const [arxivId, setArxivId] = useState(initialArxiv);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [model, setModel] = useState("codex/codex");
  const [template, setTemplate] = useState(initialMode);
  const [rounds, setRounds] = useState("2");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!arxivId.trim() && activeTab === "arxiv") {
      setError("Please enter an arXiv ID");
      return;
    }
    if (!pdfFile && activeTab === "upload") {
      setError("Please select a PDF file");
      return;
    }
    setLoading(true);
    setError("");
    setStatus("Fetching and ingesting paper...");

    try {
      // Step 1: Ingest paper
      let ingestRes: Response;
      if (activeTab === "upload" && pdfFile) {
        const form = new FormData();
        form.append("file", pdfFile);
        ingestRes = await fetch("/api/papers/ingest", { method: "POST", body: form });
      } else {
        ingestRes = await fetch("/api/papers/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arxivId: arxivId.trim() }),
        });
      }
      if (!ingestRes.ok) {
        const err = await ingestRes.json();
        throw new Error(err.error ?? "Ingest failed");
      }
      const ingestData = await ingestRes.json() as { libraryId: string; title: string };

      setStatus("Creating review session...");

      // Step 2: Build seats
      const seats = template === "gap"
        ? buildGapAnalysisSeats(model)
        : buildAcademicCritiqueSeats(model);

      // Assign libraryId to all seats
      const seatsWithLib = seats.map((s) => ({ ...s, library_id: ingestData.libraryId }));

      // Step 3: Create council session
      const councilRes = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Review: ${ingestData.title}`,
          topic: `Academic paper review: ${ingestData.title}`,
          context: `Library ID: ${ingestData.libraryId}. The paper has been ingested. Reviewers should use rag_query with the assigned library to access the paper content.`,
          goal: template === "gap"
            ? "Identify all gaps, weaknesses, and improvements needed before this paper can be submitted."
            : "Provide a comprehensive peer review verdict with structured consensus, dissent, and action items.",
          rounds: Number(rounds),
          seats: seatsWithLib,
          moderator_model: "codex/codex",
        }),
      });
      if (!councilRes.ok) {
        const err = await councilRes.json();
        throw new Error(err.error ?? "Failed to create session");
      }
      const { id } = await councilRes.json() as { id: string };

      setStatus("Redirecting...");
      router.push(`/results/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>Council</a>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>New Review</span>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>New Peer Review</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          Configure your AI review committee and submit a paper.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          {(["arxiv", "upload"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab === "arxiv" ? "arXiv / DOI" : "Upload PDF"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* arXiv tab */}
          {activeTab === "arxiv" && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>
                arXiv ID
              </label>
              <input
                type="text"
                value={arxivId}
                onChange={(e) => setArxivId(e.target.value)}
                placeholder="e.g. 2301.07041 or arxiv:2301.07041"
                style={{ width: "100%", height: 44, fontSize: 15 }}
              />
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                The PDF will be fetched directly from arxiv.org
              </div>
            </div>
          )}

          {/* Upload tab */}
          {activeTab === "upload" && (
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="pdf-upload"
                style={{
                  display: "block",
                  background: "var(--bg-card)",
                  border: `2px dashed ${pdfFile ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "40px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 150ms ease",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.type === "application/pdf") setPdfFile(f);
                }}
              >
                {pdfFile ? (
                  <div>
                    <div style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB — click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>Drop a PDF here or click to browse</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Max 20 MB</div>
                  </div>
                )}
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPdfFile(f);
                }}
              />
            </div>
          )}

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%", height: 40 }}>
                {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Template</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value)} style={{ width: "100%", height: 40 }}>
                {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Rounds</label>
              <select value={rounds} onChange={(e) => setRounds(e.target.value)} style={{ width: "100%", height: 40 }}>
                <option value="1">1 round</option>
                <option value="2">2 rounds</option>
              </select>
            </div>
          </div>

          {/* Template description */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 24,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}>
            {TEMPLATES.find((t) => t.value === template)?.description}
          </div>

          {error && (
            <div style={{ background: "#ef444422", border: "1px solid var(--danger)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, color: "var(--danger)", fontSize: 13 }}>
              {error}
            </div>
          )}

          {status && (
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>{status}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 48,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Processing..." : "Start Review Committee"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: "var(--text-secondary)",
};

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: "var(--text-secondary)" }}>Loading...</div>}>
      <AnalyzeForm />
    </Suspense>
  );
}
