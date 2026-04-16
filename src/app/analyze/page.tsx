"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildAcademicCritiqueSeats, buildGapAnalysisSeats } from "@/lib/council-academic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex h-14 items-center gap-4 border-b border-border px-6">
        <a href="/" className="text-lg font-bold text-[#6366f1] no-underline">Council</a>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">New Review</span>
      </nav>

      <div className="mx-auto max-w-[640px] px-6 py-12">
        <h1 className="mb-2 text-[28px] font-bold">New Peer Review</h1>
        <p className="mb-8 text-muted-foreground">
          Configure your AI review committee and submit a paper.
        </p>

        <Card>
          <CardContent className="pt-6">
            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "arxiv" | "upload")}
              className="mb-6"
            >
              <TabsList className="w-full">
                <TabsTrigger value="arxiv" className="flex-1">arXiv / DOI</TabsTrigger>
                <TabsTrigger value="upload" className="flex-1">Upload PDF</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* arXiv tab */}
              {activeTab === "arxiv" && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-muted-foreground">
                    arXiv ID
                  </label>
                  <Input
                    type="text"
                    value={arxivId}
                    onChange={(e) => setArxivId(e.target.value)}
                    placeholder="e.g. 2301.07041 or arxiv:2301.07041"
                    className="h-11 text-[15px]"
                  />
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    The PDF will be fetched directly from arxiv.org
                  </div>
                </div>
              )}

              {/* Upload tab */}
              {activeTab === "upload" && (
                <div>
                  <label
                    htmlFor="pdf-upload"
                    className={cn(
                      "block cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150",
                      pdfFile ? "border-[#6366f1] bg-[#eef2ff]" : "border-border bg-card hover:border-[#6366f1]/50"
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f?.type === "application/pdf") setPdfFile(f);
                    }}
                  >
                    {pdfFile ? (
                      <div>
                        <div className="mb-1 font-semibold text-[#6366f1]">{pdfFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(pdfFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-1.5 text-sm text-muted-foreground">Drop a PDF here or click to browse</div>
                        <div className="text-xs text-muted-foreground">Max 20 MB</div>
                      </div>
                    )}
                  </label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPdfFile(f);
                    }}
                  />
                </div>
              )}

              {/* Options */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Model</label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Template</label>
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Rounds</label>
                  <Select value={rounds} onValueChange={setRounds}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 round</SelectItem>
                      <SelectItem value="2">2 rounds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Template description */}
              <div className="rounded-md border border-border bg-muted px-[14px] py-2.5 text-[13px] text-muted-foreground">
                {TEMPLATES.find((t) => t.value === template)?.description}
              </div>

              {error && (
                <div className="rounded-md border border-red-400 bg-red-500/[0.13] px-[14px] py-2.5 text-[13px] text-red-600">
                  {error}
                </div>
              )}

              {status && (
                <div className="text-[13px] text-muted-foreground">{status}</div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "h-12 w-full rounded-lg bg-[#6366f1] text-[15px] font-bold text-white hover:bg-[#4f46e5]",
                  loading && "opacity-70"
                )}
              >
                {loading ? "Processing..." : "Start Review Committee"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="p-12 text-muted-foreground">Loading...</div>}>
      <AnalyzeForm />
    </Suspense>
  );
}
