"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CouncilSession, CouncilTurn, CouncilConclusion } from "@/lib/council-types";

interface SessionBundle {
  session: CouncilSession | null;
  turns: CouncilTurn[];
  conclusion: CouncilConclusion | null;
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [autoStartPending, setAutoStartPending] = useState(false);
  const eventSourceRef = useRef<(() => void) | null>(null);

  async function fetchBundle(): Promise<SessionBundle | null> {
    try {
      const res = await fetch(`/api/council/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json() as SessionBundle;
      setBundle(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBundle().then((data) => {
      // auto-start if the session is pending (e.g. coming from analyze page)
      if (data?.session?.status === "pending") {
        setAutoStartPending(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (autoStartPending && !running) {
      setAutoStartPending(false);
      startDebate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartPending]);

  function startDebate() {
    if (running) return;
    setRunning(true);
    setStreamLog([]);
    setError("");

    const ctrl = new AbortController();
    eventSourceRef.current = () => ctrl.abort();

    fetch(`/api/council/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: true }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            handleEvent(event);
          } catch { /* skip */ }
        }
      }

      setRunning(false);
      await fetchBundle();
    }).catch((err) => {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
      setRunning(false);
    });
  }

  function handleEvent(event: { type: string; [key: string]: unknown }) {
    switch (event.type) {
      case "session_start":
        setStreamLog((p) => [...p, "Session started..."]);
        break;
      case "round_start":
        setStreamLog((p) => [...p, `\n--- Round ${event.round} ---`]);
        break;
      case "turn_start":
        setStreamLog((p) => [...p, `${event.role} (${event.model}) is thinking...`]);
        break;
      case "turn_done":
        setStreamLog((p) => [...p, `${(event.turn as CouncilTurn)?.role} done.`]);
        break;
      case "moderator_start":
        setStreamLog((p) => [...p, "\n--- Moderator synthesizing... ---"]);
        break;
      case "conclusion":
        setStreamLog((p) => [...p, "Conclusion ready."]);
        break;
      case "session_done":
        setStreamLog((p) => [...p, "\nSession complete."]);
        break;
      case "error":
        setError(String(event.message));
        break;
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div style={{ padding: 48, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Preparing review committee...
        </div>
      </PageShell>
    );
  }

  if (!bundle?.session) {
    return <PageShell><div style={{ padding: 48, color: "var(--danger)" }}>Session not found.</div></PageShell>;
  }

  const { session, turns, conclusion } = bundle;
  const round1 = turns.filter((t) => t.round === 1);
  const round2 = turns.filter((t) => t.round === 2);
  const isPending = session.status === "pending" || session.status === "failed";

  return (
    <PageShell>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Back to home
          </a>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>
            {session.title}
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={session.status} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {session.seats.length} seats · {session.rounds} round{session.rounds > 1 ? "s" : ""}
            </span>
            {session.divergence_level && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Divergence: {session.divergence_level}
              </span>
            )}
          </div>
        </div>

        {/* Start button */}
        {isPending && !running && (
          <button
            onClick={startDebate}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 32,
              cursor: "pointer",
            }}
          >
            Start Debate
          </button>
        )}

        {/* Stream log */}
        {running && streamLog.length > 0 && (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            fontFamily: "monospace",
            fontSize: 12,
            color: "var(--text-secondary)",
            maxHeight: 200,
            overflowY: "auto",
          }}>
            {streamLog.map((line, i) => <div key={i}>{line}</div>)}
            <div style={{ display: "inline-block", width: 8, height: 14, background: "var(--accent)", animation: "blink 1s infinite" }} />
          </div>
        )}

        {error && (
          <div style={{ background: "#ef444422", border: "1px solid var(--danger)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Conclusion */}
        {conclusion && <ConclusionCard conclusion={conclusion} />}

        {/* Turns */}
        {round1.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-secondary)" }}>Round 1</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {round1.map((turn) => <TurnCard key={turn.id} turn={turn} />)}
            </div>
          </section>
        )}

        {round2.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-secondary)" }}>Round 2</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {round2.map((turn) => <TurnCard key={turn.id} turn={turn} />)}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>Council</a>
      </nav>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#f59e0b22", text: "#f59e0b" },
    running: { bg: "#6366f122", text: "#6366f1" },
    concluded: { bg: "#22c55e22", text: "#22c55e" },
    failed: { bg: "#ef444422", text: "#ef4444" },
  };
  const c = colors[status] ?? { bg: "var(--bg-card)", text: "var(--text-secondary)" };
  return (
    <span style={{
      background: c.bg,
      color: c.text,
      fontSize: 11,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 4,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    }}>{status}</span>
  );
}

function ConclusionCard({ conclusion }: { conclusion: CouncilConclusion }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-accent)",
      borderRadius: 10,
      padding: 24,
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Moderator Verdict</h2>
        {conclusion.confidence && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            background: conclusion.confidence === "high" ? "#22c55e22" : conclusion.confidence === "medium" ? "#f59e0b22" : "#ef444422",
            color: conclusion.confidence === "high" ? "#22c55e" : conclusion.confidence === "medium" ? "#f59e0b" : "#ef4444",
          }}>
            {conclusion.confidence.toUpperCase()} CONFIDENCE
          </span>
        )}
      </div>

      <div style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{conclusion.summary}</ReactMarkdown>
      </div>

      {conclusion.consensus && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>CONSENSUS</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{conclusion.consensus}</ReactMarkdown>
          </div>
        </div>
      )}

      {conclusion.dissent && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>DISSENT</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{conclusion.dissent}</ReactMarkdown>
          </div>
        </div>
      )}

      {conclusion.action_items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>ACTION ITEMS</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {conclusion.action_items.map((item, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.6 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {conclusion.veto && (
        <div style={{ background: "#ef444411", border: "1px solid #ef444433", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>VETO</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{conclusion.veto}</div>
        </div>
      )}
    </div>
  );
}

function TurnCard({ turn }: { turn: CouncilTurn }) {
  const [expanded, setExpanded] = useState(false);
  const preview = turn.content.slice(0, 300);
  const needsExpand = turn.content.length > 300;

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{turn.role}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 8 }}>{turn.model}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {turn.input_tokens + turn.output_tokens} tokens
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {expanded ? turn.content : preview + (needsExpand ? "..." : "")}
        </ReactMarkdown>
      </div>
      {needsExpand && (
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: 12,
            cursor: "pointer",
            marginTop: 8,
            padding: 0,
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
