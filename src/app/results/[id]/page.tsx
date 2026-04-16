"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type {
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidence,
  CouncilEvidenceSource,
} from "@/lib/council-types";

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  { main: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { main: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
  { main: "#f43f5e", bg: "#fff1f2", border: "#fecdd3" },
  { main: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  { main: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  { main: "#8b5cf6", bg: "#faf5ff", border: "#ddd6fe" },
  { main: "#14b8a6", bg: "#f0fdfa", border: "#99f6e4" },
  { main: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
];
const MOD_COLOR = { main: "#374151", bg: "#f9fafb", border: "#d1d5db" };

function getColor(role: string, seats: { role: string }[]) {
  if (role.toLowerCase().includes("moderator")) return MOD_COLOR;
  const idx = seats.findIndex((s) => s.role === role);
  return PALETTE[Math.max(0, idx) % PALETTE.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  sourceRefs?: CouncilEvidenceSource[];
  status: "pending" | "completed" | "failed";
}

type Segment = { type: "text"; content: string } | { type: "tool"; call: ToolCall };

interface Speaker {
  role: string;
  model: string;
  round: number;
  segments: Segment[];
}

interface AgentStatus {
  role: string;
  model: string;
  status: "waiting" | "thinking" | "done";
}

type FloorItem =
  | { kind: "turn"; role: string; model: string; segments: Segment[]; round: number; tokens: number }
  | { kind: "divider"; round: number; divergence?: { level: string; summary: string } }
  | { kind: "conclusion"; data: CouncilConclusion };

interface DivState {
  level: "none" | "low" | "moderate" | "high";
  summary: string;
}

interface Bundle {
  session: CouncilSession | null;
  turns: CouncilTurn[];
  conclusion: CouncilConclusion | null;
  evidence: CouncilEvidence[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<CouncilSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [floor, setFloor] = useState<FloorItem[]>([]);
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);
  const [divergence, setDivergence] = useState<DivState | null>(null);
  const [error, setError] = useState("");

  const speakerRef = useRef<Speaker | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  function mutateSpeaker(fn: (prev: Speaker | null) => Speaker | null) {
    setSpeaker((prev) => {
      const next = fn(prev);
      speakerRef.current = next;
      return next;
    });
  }

  async function loadSession(skipHistory = false) {
    try {
      const res = await fetch(`/api/council/${id}`);
      if (!res.ok) throw new Error("Session not found");
      const data = (await res.json()) as Bundle;
      setSession(data.session);
      if (data.session) {
        setStatuses(
          data.session.seats.map((s) => ({ role: s.role, model: s.model, status: "waiting" as const }))
        );
        if (!skipHistory && data.session.status === "concluded") {
          buildFloor(data);
        }
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function buildFloor(data: Bundle) {
    const items: FloorItem[] = [];
    const rounds = [...new Set(data.turns.map((t) => t.round))].sort((a, b) => a - b);
    for (const r of rounds) {
      if (r > 1) {
        const divEvidence = data.evidence?.find((e) => e.round === r - 1 && e.tool === "divergence_check");
        items.push({ kind: "divider", round: r, divergence: divEvidence ? { level: data.session?.divergence_level ?? "moderate", summary: "" } : undefined });
      }
      for (const t of data.turns.filter((x) => x.round === r)) {
        const turnEvidence = (data.evidence ?? []).filter((e) => e.round === r && e.role === t.role && e.status === "completed");
        const segments: Segment[] = [];
        for (const ev of turnEvidence) {
          const call: ToolCall = {
            id: ev.id,
            tool: ev.tool,
            args: ev.args,
            result: ev.result,
            sourceRefs: ev.source_refs.length > 0 ? ev.source_refs : undefined,
            status: "completed",
          };
          segments.push({ type: "tool", call });
        }
        segments.push({ type: "text", content: t.content });
        items.push({
          kind: "turn",
          role: t.role, model: t.model,
          segments,
          round: t.round,
          tokens: t.input_tokens + t.output_tokens,
        });
      }
    }
    if (data.conclusion) items.push({ kind: "conclusion", data: data.conclusion });
    setFloor(items);
    setStatuses((prev) => prev.map((a) => ({ ...a, status: "done" })));
  }

  useEffect(() => {
    loadSession().then((data) => {
      if (data?.session?.status === "pending") startDebate();
    });
    return () => abortRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleEvent(ev: { type: string; [k: string]: unknown }) {
    switch (ev.type) {
      case "session_start":
        setFloor([]); setDivergence(null); setError(""); break;

      case "round_start":
        if ((ev.round as number) > 1)
          setFloor((f) => [...f, { kind: "divider", round: ev.round as number }]);
        break;

      case "turn_start":
        mutateSpeaker(() => ({ role: ev.role as string, model: ev.model as string, round: ev.round as number, segments: [] }));
        setStatuses((prev) => prev.map((a) => a.role === ev.role ? { ...a, status: "thinking" } : a));
        setTimeout(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
        break;

      case "turn_delta": {
        const d = ev.delta as string;
        mutateSpeaker((prev) => {
          if (!prev) return null;
          const segs = [...prev.segments];
          const last = segs[segs.length - 1];
          if (last?.type === "text") segs[segs.length - 1] = { type: "text", content: last.content + d };
          else segs.push({ type: "text", content: d });
          return { ...prev, segments: segs };
        });
        break;
      }

      case "tool_call": {
        const tc: ToolCall = { id: `${ev.tool as string}-${Date.now()}`, tool: ev.tool as string, args: ev.args as Record<string, unknown>, status: "pending" };
        mutateSpeaker((prev) => prev ? { ...prev, segments: [...prev.segments, { type: "tool", call: tc }] } : null);
        break;
      }

      case "tool_result": {
        mutateSpeaker((prev) => {
          if (!prev) return null;
          let hit = false;
          const segs = prev.segments.map((seg) => {
            if (!hit && seg.type === "tool" && seg.call.tool === ev.tool && seg.call.status === "pending") {
              hit = true;
              return { ...seg, call: { ...seg.call, result: ev.result as string, sourceRefs: ev.sourceRefs as CouncilEvidenceSource[] | undefined, status: "completed" as const } };
            }
            return seg;
          });
          return { ...prev, segments: segs };
        });
        break;
      }

      case "turn_done": {
        const done = ev.turn as CouncilTurn;
        const curr = speakerRef.current;
        if (curr) setFloor((f) => [...f, { kind: "turn", role: curr.role, model: curr.model, segments: curr.segments, round: curr.round, tokens: done.input_tokens + done.output_tokens }]);
        setSpeaker(null); speakerRef.current = null;
        setStatuses((prev) => prev.map((a) => a.role === done.role ? { ...a, status: "done" } : a));
        break;
      }

      case "moderator_start":
        mutateSpeaker(() => ({ role: "Moderator", model: "moderator", round: 99, segments: [] }));
        setTimeout(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
        break;

      case "moderator_delta": {
        const d = ev.delta as string;
        mutateSpeaker((prev) => {
          if (!prev) return null;
          const segs = [...prev.segments];
          const last = segs[segs.length - 1];
          if (last?.type === "text") segs[segs.length - 1] = { type: "text", content: last.content + d };
          else segs.push({ type: "text", content: d });
          return { ...prev, segments: segs };
        });
        break;
      }

      case "divergence_check":
        setDivergence({ level: ev.level as DivState["level"], summary: ev.summary as string });
        setFloor((f) => {
          const copy = [...f];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].kind === "divider") {
              copy[i] = { ...(copy[i] as { kind: "divider"; round: number }), divergence: { level: ev.level as string, summary: ev.summary as string } };
              break;
            }
          }
          return copy;
        });
        break;

      case "conclusion":
        setFloor((f) => [...f, { kind: "conclusion", data: ev.conclusion as CouncilConclusion }]);
        setSpeaker(null); speakerRef.current = null;
        break;

      case "session_done":
        setRunning(false);
        fetch(`/api/council/${id}`).then((r) => r.json()).then((d: Bundle) => setSession(d.session)).catch(() => {});
        break;

      case "error":
        setError(ev.message as string); setRunning(false); break;
    }
  }

  function startDebate() {
    if (running) return;
    setRunning(true); setFloor([]); setSpeaker(null); speakerRef.current = null; setError("");
    const ctrl = new AbortController();
    abortRef.current = () => ctrl.abort();
    fetch(`/api/council/${id}/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: true }), signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try { handleEvent(JSON.parse(line.slice(6))); } catch { /* skip */ }
        }
      }
      setRunning(false);
    }).catch((err) => { if (err.name !== "AbortError") setError(err.message); setRunning(false); });
  }

  const seats = session?.seats ?? [];
  const isPending = session?.status === "pending" || session?.status === "failed";

  if (loading) return (
    <Shell>
      <div className="flex items-center gap-3 px-12 py-20 text-muted-foreground">
        <Spinner /> Preparing review committee...
      </div>
    </Shell>
  );

  if (!session) return (
    <Shell>
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-foreground mb-1.5">Session not found</h2>
          <p className="text-[14px] text-muted-foreground mb-6">This review session doesn&apos;t exist or you don&apos;t have access.</p>
          <div className="flex gap-3 justify-center">
            <a href="/home" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-[13px] font-semibold no-underline hover:bg-[#5558e8] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Back to Dashboard
            </a>
            <a href="/analyze" className="inline-flex items-center px-4 py-2 rounded-lg border border-border text-[13px] font-medium text-foreground no-underline hover:bg-muted transition-colors">
              New Review
            </a>
          </div>
        </div>
      </div>
    </Shell>
  );

  return (
    <Shell>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border flex items-center px-6 z-[100] gap-3">
        <a
          href="/home"
          className="flex items-center gap-1.5 text-muted-foreground no-underline hover:text-foreground transition-colors shrink-0 group"
          title="Back to Dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span className="font-bold text-base text-[#6366f1]">Council</span>
        </a>
        <span className="text-border shrink-0">›</span>
        <span className="text-[13px] text-foreground font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{session.title}</span>
        <StatusPill status={session.status} running={running} />
        {running && <span className="text-[12px] text-muted-foreground shrink-0">Round {speaker?.round ?? 1}</span>}
      </nav>

      {/* Body */}
      <div className="flex mt-14 h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside className="w-[248px] shrink-0 border-r border-border bg-muted overflow-y-auto flex flex-col">
          <div className="px-3.5 pt-5 pb-3">
            <div className="text-[10px] font-bold text-muted-foreground tracking-[0.1em] mb-2.5">COMMITTEE</div>
            <div className="flex flex-col gap-1">
              {statuses.map((a) => (
                <AgentRow key={a.role} role={a.role} model={a.model} status={a.status}
                  isActive={speaker?.role === a.role} color={getColor(a.role, seats)} />
              ))}
            </div>
          </div>

          {divergence && divergence.level !== "none" && (
            <div className="mx-3.5 my-2 p-3 bg-background rounded-lg border border-border">
              <div className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground mb-1.5">DIVERGENCE</div>
              <DivMeter level={divergence.level} />
              <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{divergence.summary}</div>
            </div>
          )}

          {isPending && !running && (
            <div className="px-3.5 py-3">
              <button
                onClick={startDebate}
                className="w-full bg-[#6366f1] text-white border-none rounded-lg py-2.5 text-[14px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              >
                Start Debate
              </button>
            </div>
          )}
        </aside>

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-9 py-7">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-red-500 text-[13px]">{error}</div>
          )}
          {speaker && <ActivePanel speaker={speaker} seats={seats} />}
          {floor.length > 0 && <Floor items={floor} seats={seats} />}
          {!speaker && floor.length === 0 && !running && (
            <div className="text-muted-foreground text-[14px] pt-[60px] text-center">
              {isPending ? "Click \"Start Debate\" to begin." : "No turns recorded."}
            </div>
          )}
        </main>
      </div>
    </Shell>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .animate-pulse-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
        .animate-blink { animation: blink 1s infinite; }
        .animate-spin-custom { animation: spin 0.8s linear infinite; }
      `}</style>
      {children}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status, running }: { status: string; running: boolean }) {
  const s = running ? "running" : status;
  const map: Record<string, [string, string]> = {
    pending: ["#fef3c7", "#d97706"],
    running: ["#ede9fe", "#7c3aed"],
    concluded: ["#dcfce7", "#16a34a"],
    failed: ["#fee2e2", "#dc2626"],
  };
  const [bg, text] = map[s] ?? ["#f3f4f6", "#6b7280"];
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded tracking-[0.05em] uppercase shrink-0"
      style={{ background: bg, color: text }}
    >
      {s}
    </span>
  );
}

// ─── Agent row ────────────────────────────────────────────────────────────────
function AgentRow({ role, model, status, isActive, color }: {
  role: string; model: string; status: AgentStatus["status"]; isActive: boolean;
  color: { main: string; bg: string; border: string };
}) {
  const shortModel = model.replace(/^claude-/, "").replace(/-\d{8}$/, "").replace("claude-", "");
  return (
    <div
      className="flex items-center gap-2 py-[7px] px-2.5 rounded-lg transition-all duration-200"
      style={{
        background: isActive ? color.bg : "transparent",
        border: `1px solid ${isActive ? color.border : "transparent"}`,
      }}
    >
      <div
        className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0"
        style={{
          background: status === "waiting" ? "#f3f4f6" : color.bg,
          border: `2px solid ${status === "waiting" ? "#d1d5db" : color.main}`,
          color: status === "waiting" ? "#9ca3af" : color.main,
        }}
      >
        {role.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ color: status === "waiting" ? "#9ca3af" : "#1a1a1a" }}
        >
          {role}
        </div>
        <div className="text-[10px] text-muted-foreground">{shortModel}</div>
      </div>
      {status === "waiting" && (
        <div className="w-[7px] h-[7px] rounded-full bg-[#e5e7eb] shrink-0" />
      )}
      {status === "thinking" && (
        <div
          className="w-[7px] h-[7px] rounded-full shrink-0 animate-pulse-dot"
          style={{ background: color.main }}
        />
      )}
      {status === "done" && (
        <div className="w-4 h-4 rounded-full bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center text-[9px] text-[#16a34a] shrink-0">
          ✓
        </div>
      )}
    </div>
  );
}

// ─── Divergence meter ─────────────────────────────────────────────────────────
function DivMeter({ level }: { level: DivState["level"] }) {
  const widths = { none: "0%", low: "25%", moderate: "60%", high: "100%" };
  const colors = { none: "#22c55e", low: "#86efac", moderate: "#f59e0b", high: "#ef4444" };
  return (
    <div className="h-[5px] bg-[#e5e5e3] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-[width,background] duration-700 ease-in-out"
        style={{ width: widths[level], background: colors[level] }}
      />
    </div>
  );
}

// ─── Active speaker panel ─────────────────────────────────────────────────────
function ActivePanel({ speaker, seats }: { speaker: Speaker; seats: { role: string }[] }) {
  const color = getColor(speaker.role, seats);
  const isMod = speaker.role.toLowerCase().includes("moderator");
  return (
    <div
      className="mb-6 rounded-[0_12px_12px_0] bg-background overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
      style={{
        border: `1px solid ${color.border}`,
        borderLeft: `4px solid ${color.main}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-[13px] border-b"
        style={{ borderColor: color.border, background: color.bg }}
      >
        <div
          className="w-[34px] h-[34px] rounded-full bg-background flex items-center justify-center text-[11px] font-extrabold"
          style={{ border: `2px solid ${color.main}`, color: color.main }}
        >
          {speaker.role.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-[14px] font-bold text-foreground flex items-center gap-2">
            {speaker.role}
            {isMod && (
              <span className="text-[10px] font-bold bg-[#374151] text-white px-1.5 py-px rounded tracking-[0.06em]">
                MODERATOR
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{speaker.model}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ background: color.main }}
          />
          <span className="text-[11px] font-semibold" style={{ color: color.main }}>Speaking</span>
        </div>
      </div>
      {/* Content */}
      <div className="px-6 py-5">
        {speaker.segments.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
            <Spinner small /> Gathering thoughts...
          </div>
        ) : (
          speaker.segments.map((seg, i) =>
            seg.type === "text"
              ? <StreamText key={i} text={seg.content} showCursor={i === speaker.segments.length - 1} />
              : <ToolBlock key={i} call={seg.call} />
          )
        )}
      </div>
    </div>
  );
}

function StreamText({ text, showCursor }: { text: string; showCursor: boolean }) {
  return (
    <div className="text-[14px] leading-[1.8] text-foreground mb-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      {showCursor && (
        <span className="inline-block w-0.5 h-4 bg-[#6366f1] ml-px align-text-bottom animate-blink" />
      )}
    </div>
  );
}

// ─── Tool call block ──────────────────────────────────────────────────────────
function ToolBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const argsStr = Object.entries(call.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
  const icon = call.status === "pending" ? "⏳" : call.status === "completed" ? "🔍" : "❌";
  return (
    <div className="my-2.5 bg-muted border border-border rounded-lg overflow-hidden text-[12px]">
      <div
        onClick={() => call.status === "completed" && setOpen((p) => !p)}
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          call.status === "completed" ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span>{icon}</span>
        <code className="text-[#6366f1] font-mono font-semibold">{call.tool}</code>
        <span className="text-muted-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          ({argsStr.slice(0, 80)}{argsStr.length > 80 ? "…" : ""})
        </span>
        {call.status === "pending" && <Spinner small />}
        {call.status === "completed" && call.sourceRefs && call.sourceRefs.length > 0 && (
          <span className="text-[#6366f1] font-semibold shrink-0">
            {call.sourceRefs.length} source{call.sourceRefs.length > 1 ? "s" : ""} {open ? "▲" : "▼"}
          </span>
        )}
      </div>
      {open && call.sourceRefs && call.sourceRefs.length > 0 && (
        <div className="border-t border-border px-3 py-2.5 flex flex-col gap-2">
          {call.sourceRefs.map((ref, i) => (
            <div key={i}>
              <div className="font-semibold text-foreground text-[12px]">
                {ref.uri
                  ? <a href={ref.uri} target="_blank" rel="noopener noreferrer" className="text-[#6366f1]">{ref.label}</a>
                  : ref.label
                }
              </div>
              {ref.snippet && (
                <div className="text-muted-foreground italic leading-relaxed text-[11px] mt-0.5">{ref.snippet}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Floor ────────────────────────────────────────────────────────────────────
function Floor({ items, seats }: { items: FloorItem[]; seats: { role: string }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        if (item.kind === "divider") return <RoundDivider key={i} round={item.round} divergence={item.divergence} />;
        if (item.kind === "conclusion") return <VerdictCard key={i} data={item.data} />;
        return <TurnCard key={i} item={item} color={getColor(item.role, seats)} />;
      })}
    </div>
  );
}

function RoundDivider({ round, divergence }: { round: number; divergence?: { level: string; summary: string } }) {
  const hot = divergence?.level === "high" || divergence?.level === "moderate";
  return (
    <div className="my-6 mb-4 text-center relative">
      <div
        className="absolute top-1/2 left-0 right-0 h-px"
        style={{ background: hot ? "#fde68a" : "#e5e5e3" }}
      />
      <span
        className={cn(
          "relative inline-block px-3.5 py-[3px] rounded-full text-[11px] font-bold tracking-[0.06em]",
          hot
            ? "bg-[#fffbeb] border border-[#fde68a] text-[#d97706]"
            : "bg-[#f5f5f4] border border-[#e5e5e3] text-muted-foreground"
        )}
      >
        ROUND {round}{divergence ? ` — ${divergence.level.toUpperCase()} DIVERGENCE` : ""}
      </span>
    </div>
  );
}

function TurnCard({ item, color }: { item: Extract<FloorItem, { kind: "turn" }>; color: { main: string; bg: string; border: string } }) {
  const [expanded, setExpanded] = useState(false);
  const textContent = item.segments.filter((s): s is { type: "text"; content: string } => s.type === "text").map((s) => s.content).join("");
  const preview = textContent.slice(0, 200);
  const hasMore = textContent.length > 200 || item.segments.some((s) => s.type === "tool");
  return (
    <div
      className="mb-2 rounded-[0_8px_8px_0] bg-background overflow-hidden"
      style={{
        border: "1px solid #e5e5e3",
        borderLeft: `3px solid ${color.main}`,
      }}
    >
      <div
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 px-3.5 py-[9px] cursor-pointer transition-colors duration-150"
        style={{ background: expanded ? color.bg : undefined }}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-extrabold shrink-0"
          style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.main }}
        >
          {item.role.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[12px] font-semibold text-foreground flex-1">{item.role}</span>
        <span className="text-[11px] text-muted-foreground">{item.tokens.toLocaleString()} tok</span>
        <span className="text-[10px]" style={{ color: color.main }}>{expanded ? "▲" : "▼"}</span>
      </div>
      <div className={cn("px-3.5", expanded ? "pb-3.5" : "pb-2.5")}>
        {!expanded ? (
          <div className="text-[13px] text-[#525252] leading-relaxed">{preview}{hasMore ? "…" : ""}</div>
        ) : (
          <div className="text-[13px] text-foreground leading-[1.75]">
            {item.segments.map((seg, i) =>
              seg.type === "text"
                ? <div key={i}><ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.content}</ReactMarkdown></div>
                : <ToolBlock key={i} call={seg.call} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Verdict card ─────────────────────────────────────────────────────────────
function VerdictCard({ data }: { data: CouncilConclusion }) {
  const confMap: Record<string, [string, string]> = {
    high: ["#dcfce7", "#16a34a"],
    medium: ["#fef3c7", "#d97706"],
    low: ["#fee2e2", "#dc2626"],
  };
  const [cbg, ctxt] = data.confidence ? (confMap[data.confidence] ?? confMap.medium) : ["#f3f4f6", "#6b7280"];
  return (
    <div className="mt-2 rounded-[0_12px_12px_0] bg-background overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.09)] border border-[#d1d5db]" style={{ borderLeft: "4px solid #374151" }}>
      <div className="px-5 py-3.5 bg-[#f9fafb] border-b border-[#e5e7eb] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#374151] flex items-center justify-center text-[15px] text-white">⚖</div>
        <div>
          <div className="text-[14px] font-bold text-foreground">Moderator Verdict</div>
          <div className="text-[11px] text-muted-foreground">Council synthesis</div>
        </div>
        {data.confidence && (
          <span
            className="ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded tracking-[0.05em]"
            style={{ background: cbg, color: ctxt }}
          >
            {data.confidence.toUpperCase()} CONFIDENCE
          </span>
        )}
      </div>
      <div className="px-6 py-5">
        <div className="text-[14px] text-foreground leading-[1.8] mb-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.summary}</ReactMarkdown>
        </div>
        {data.consensus && <VBlock label="CONSENSUS" color="#16a34a" bg="#f0fdf4">{data.consensus}</VBlock>}
        {data.dissent && <VBlock label="DISSENT" color="#d97706" bg="#fffbeb">{data.dissent}</VBlock>}
        {data.action_items.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-bold text-[#6366f1] tracking-[0.1em] mb-2">ACTION ITEMS</div>
            <ul className="pl-[18px] m-0 flex flex-col gap-1">
              {data.action_items.map((item, i) => (
                <li key={i} className="text-[13px] text-[#374151] leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {data.veto && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            <div className="text-[10px] font-bold text-red-500 tracking-[0.1em] mb-1">VETO</div>
            <div className="text-[13px] text-[#374151]">{data.veto}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function VBlock({ label, color, bg, children }: { label: string; color: string; bg: string; children: string }) {
  return (
    <div className="mb-2.5 rounded-lg px-3.5 py-2.5" style={{ background: bg }}>
      <div className="text-[10px] font-bold tracking-[0.1em] mb-1" style={{ color }}>{label}</div>
      <div className="text-[13px] text-[#374151] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ small }: { small?: boolean }) {
  const size = small ? "w-3 h-3" : "w-4 h-4";
  return (
    <div
      className={cn(size, "shrink-0 rounded-full border-2 border-[#e5e7eb] border-t-[#6366f1] animate-spin-custom")}
    />
  );
}
