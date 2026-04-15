"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
        // Insert tool blocks before the text so sources are visible at the top of expanded view
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "80px 48px", color: "#6b7280" }}>
        <Spinner /> Preparing review committee...
      </div>
    </Shell>
  );

  if (!session) return <Shell><div style={{ padding: 48, color: "#ef4444" }}>Session not found.</div></Shell>;

  return (
    <Shell>
      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "#fff", borderBottom: "1px solid #e5e5e3", display: "flex", alignItems: "center", padding: "0 24px", zIndex: 100, gap: 12 }}>
        <a href="/" style={{ fontWeight: 700, fontSize: 16, color: "#6366f1", textDecoration: "none", flexShrink: 0 }}>Council</a>
        <span style={{ color: "#d1d5db" }}>›</span>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</span>
        <StatusPill status={session.status} running={running} />
        {running && <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>Round {speaker?.round ?? 1}</span>}
      </nav>

      {/* Body */}
      <div style={{ display: "flex", marginTop: 56, height: "calc(100vh - 56px)" }}>
        {/* Sidebar */}
        <aside style={{ width: 248, flexShrink: 0, borderRight: "1px solid #e5e5e3", background: "#fafaf9", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 14px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10 }}>COMMITTEE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {statuses.map((a) => (
                <AgentRow key={a.role} role={a.role} model={a.model} status={a.status}
                  isActive={speaker?.role === a.role} color={getColor(a.role, seats)} />
              ))}
            </div>
          </div>

          {divergence && divergence.level !== "none" && (
            <div style={{ margin: "8px 14px", padding: "12px", background: "#fff", borderRadius: 8, border: "1px solid #e5e5e3" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 6 }}>DIVERGENCE</div>
              <DivMeter level={divergence.level} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>{divergence.summary}</div>
            </div>
          )}

          {isPending && !running && (
            <div style={{ padding: "12px 14px" }}>
              <button onClick={startDebate} style={{ width: "100%", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Start Debate
              </button>
            </div>
          )}
        </aside>

        {/* Main */}
        <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "#ef4444", fontSize: 13 }}>{error}</div>
          )}
          {speaker && <ActivePanel speaker={speaker} seats={seats} />}
          {floor.length > 0 && <Floor items={floor} seats={seats} />}
          {!speaker && floor.length === 0 && !running && (
            <div style={{ color: "#9ca3af", fontSize: 14, paddingTop: 60, textAlign: "center" }}>
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
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }`}</style>
      {children}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status, running }: { status: string; running: boolean }) {
  const s = running ? "running" : status;
  const map: Record<string, [string, string]> = {
    pending: ["#fef3c7", "#d97706"], running: ["#ede9fe", "#7c3aed"],
    concluded: ["#dcfce7", "#16a34a"], failed: ["#fee2e2", "#dc2626"],
  };
  const [bg, text] = map[s] ?? ["#f3f4f6", "#6b7280"];
  return <span style={{ background: bg, color: text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>{s}</span>;
}

// ─── Agent row ────────────────────────────────────────────────────────────────
function AgentRow({ role, model, status, isActive, color }: {
  role: string; model: string; status: AgentStatus["status"]; isActive: boolean;
  color: { main: string; bg: string; border: string };
}) {
  const shortModel = model.replace(/^claude-/, "").replace(/-\d{8}$/, "").replace("claude-", "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: isActive ? color.bg : "transparent", border: `1px solid ${isActive ? color.border : "transparent"}`, transition: "all 200ms ease" }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: status === "waiting" ? "#f3f4f6" : color.bg, border: `2px solid ${status === "waiting" ? "#d1d5db" : color.main}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: status === "waiting" ? "#9ca3af" : color.main, flexShrink: 0 }}>
        {role.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: status === "waiting" ? "#9ca3af" : "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role}</div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>{shortModel}</div>
      </div>
      {status === "waiting" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />}
      {status === "thinking" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: color.main, flexShrink: 0, animation: "pulse-dot 1.4s ease-in-out infinite" }} />}
      {status === "done" && <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#dcfce7", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#16a34a", flexShrink: 0 }}>✓</div>}
    </div>
  );
}

// ─── Divergence meter ─────────────────────────────────────────────────────────
function DivMeter({ level }: { level: DivState["level"] }) {
  const widths = { none: "0%", low: "25%", moderate: "60%", high: "100%" };
  const colors = { none: "#22c55e", low: "#86efac", moderate: "#f59e0b", high: "#ef4444" };
  return (
    <div style={{ height: 5, background: "#e5e5e3", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 3, width: widths[level], background: colors[level], transition: "width 700ms ease, background 700ms ease" }} />
    </div>
  );
}

// ─── Active speaker panel ─────────────────────────────────────────────────────
function ActivePanel({ speaker, seats }: { speaker: Speaker; seats: { role: string }[] }) {
  const color = getColor(speaker.role, seats);
  const isMod = speaker.role.toLowerCase().includes("moderator");
  return (
    <div style={{ marginBottom: 24, border: `1px solid ${color.border}`, borderLeft: `4px solid ${color.main}`, borderRadius: "0 12px 12px 0", background: "#fff", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: `1px solid ${color.border}`, background: color.bg }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", border: `2px solid ${color.main}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: color.main }}>
          {speaker.role.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
            {speaker.role}
            {isMod && <span style={{ fontSize: 10, fontWeight: 700, background: "#374151", color: "#fff", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.06em" }}>MODERATOR</span>}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{speaker.model}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color.main, animation: "pulse-dot 1.4s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, color: color.main, fontWeight: 600 }}>Speaking</span>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: "20px 24px" }}>
        {speaker.segments.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13 }}><Spinner small /> Gathering thoughts...</div>
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
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#1a1a1a", marginBottom: 4 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      {showCursor && <span style={{ display: "inline-block", width: 2, height: 16, background: "#6366f1", marginLeft: 1, verticalAlign: "text-bottom", animation: "blink 1s infinite" }} />}
    </div>
  );
}

// ─── Tool call block ──────────────────────────────────────────────────────────
function ToolBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const argsStr = Object.entries(call.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
  const icon = call.status === "pending" ? "⏳" : call.status === "completed" ? "🔍" : "❌";
  return (
    <div style={{ margin: "10px 0", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", fontSize: 12 }}>
      <div onClick={() => call.status === "completed" && setOpen((p) => !p)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: call.status === "completed" ? "pointer" : "default" }}>
        <span>{icon}</span>
        <code style={{ color: "#6366f1", fontFamily: "monospace", fontWeight: 600 }}>{call.tool}</code>
        <span style={{ color: "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>({argsStr.slice(0, 80)}{argsStr.length > 80 ? "…" : ""})</span>
        {call.status === "pending" && <Spinner small />}
        {call.status === "completed" && call.sourceRefs && call.sourceRefs.length > 0 && (
          <span style={{ color: "#6366f1", fontWeight: 600, flexShrink: 0 }}>{call.sourceRefs.length} source{call.sourceRefs.length > 1 ? "s" : ""} {open ? "▲" : "▼"}</span>
        )}
      </div>
      {open && call.sourceRefs && call.sourceRefs.length > 0 && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {call.sourceRefs.map((ref, i) => (
            <div key={i}>
              <div style={{ fontWeight: 600, color: "#374151", fontSize: 12 }}>
                {ref.uri ? <a href={ref.uri} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>{ref.label}</a> : ref.label}
              </div>
              {ref.snippet && <div style={{ color: "#6b7280", fontStyle: "italic", lineHeight: 1.5, fontSize: 11, marginTop: 2 }}>{ref.snippet}</div>}
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
    <div style={{ display: "flex", flexDirection: "column" }}>
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
    <div style={{ margin: "24px 0 16px", textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: hot ? "#fde68a" : "#e5e5e3" }} />
      <span style={{ position: "relative", display: "inline-block", padding: "3px 14px", borderRadius: 20, background: hot ? "#fffbeb" : "#f5f5f4", border: `1px solid ${hot ? "#fde68a" : "#e5e5e3"}`, fontSize: 11, fontWeight: 700, color: hot ? "#d97706" : "#6b7280", letterSpacing: "0.06em" }}>
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
    <div style={{ marginBottom: 8, border: "1px solid #e5e5e3", borderLeft: `3px solid ${color.main}`, borderRadius: "0 8px 8px 0", background: "#fff", overflow: "hidden" }}>
      <div onClick={() => setExpanded((p) => !p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", cursor: "pointer", background: expanded ? color.bg : "#fff", transition: "background 150ms ease" }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: color.bg, border: `1px solid ${color.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: color.main, flexShrink: 0 }}>
          {item.role.slice(0, 2).toUpperCase()}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", flex: 1 }}>{item.role}</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{item.tokens.toLocaleString()} tok</span>
        <span style={{ fontSize: 10, color: color.main }}>{expanded ? "▲" : "▼"}</span>
      </div>
      <div style={{ padding: expanded ? "0 14px 14px" : "0 14px 10px" }}>
        {!expanded ? (
          <div style={{ fontSize: 13, color: "#525252", lineHeight: 1.6 }}>{preview}{hasMore ? "…" : ""}</div>
        ) : (
          <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.75 }}>
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
  const confMap: Record<string, [string, string]> = { high: ["#dcfce7", "#16a34a"], medium: ["#fef3c7", "#d97706"], low: ["#fee2e2", "#dc2626"] };
  const [cbg, ctxt] = data.confidence ? (confMap[data.confidence] ?? confMap.medium) : ["#f3f4f6", "#6b7280"];
  return (
    <div style={{ marginTop: 8, border: "1px solid #d1d5db", borderLeft: "4px solid #374151", borderRadius: "0 12px 12px 0", background: "#fff", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.09)" }}>
      <div style={{ padding: "14px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff" }}>⚖</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Moderator Verdict</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>Council synthesis</div>
        </div>
        {data.confidence && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: cbg, color: ctxt, padding: "2px 10px", borderRadius: 4, letterSpacing: "0.05em" }}>
            {data.confidence.toUpperCase()} CONFIDENCE
          </span>
        )}
      </div>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.8, marginBottom: 16 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.summary}</ReactMarkdown>
        </div>
        {data.consensus && <VBlock label="CONSENSUS" color="#16a34a" bg="#f0fdf4">{data.consensus}</VBlock>}
        {data.dissent && <VBlock label="DISSENT" color="#d97706" bg="#fffbeb">{data.dissent}</VBlock>}
        {data.action_items.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", letterSpacing: "0.1em", marginBottom: 8 }}>ACTION ITEMS</div>
            <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {data.action_items.map((item, i) => <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{item}</li>)}
            </ul>
          </div>
        )}
        {data.veto && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", marginBottom: 4 }}>VETO</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{data.veto}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function VBlock({ label, color, bg, children }: { label: string; color: string; bg: string; children: string }) {
  return (
    <div style={{ marginBottom: 10, background: bg, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ small }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return <div style={{ width: s, height: s, flexShrink: 0, border: "2px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />;
}
