import { notFound } from "next/navigation";
import { getCouncilSessionBundle } from "@/lib/council";
import { db } from "@/lib/db";
import type { CouncilTurn, CouncilConclusion } from "@/lib/council-types";

async function getPublicBundle(id: string) {
  const { rows } = await db.query(
    `SELECT is_public FROM council_sessions WHERE id = $1`,
    [id]
  );
  if (!rows.length || !(rows[0] as { is_public: boolean }).is_public) return null;
  return getCouncilSessionBundle(id);
}

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, string> = {
    high: "#22c55e",
    medium: "#f59e0b",
    low: "#ef4444",
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
      color: colors[level] ?? "#888",
      border: `1px solid ${colors[level] ?? "#ddd"}`,
      borderRadius: 20, padding: "2px 10px",
      textTransform: "capitalize",
    }}>
      {level} confidence
    </span>
  );
}

function TurnCard({ turn }: { turn: CouncilTurn }) {
  return (
    <div style={{
      border: "1px solid #ebebed", borderRadius: 10, padding: "16px 20px",
      background: "#fff", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: "50%",
          background: "#6366f1", color: "#fff",
          fontSize: 11, fontWeight: 700,
        }}>
          {turn.role.charAt(0).toUpperCase()}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{turn.role}</span>
        <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>Round {turn.round}</span>
      </div>
      <div style={{
        fontSize: 14, color: "#444", lineHeight: 1.7,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {turn.content}
      </div>
    </div>
  );
}

function ConclusionSection({ conclusion }: { conclusion: CouncilConclusion }) {
  return (
    <div style={{
      border: "1px solid #c7d2fe", borderRadius: 12, padding: "24px 28px",
      background: "#f5f3ff", marginTop: 32,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#4338ca", margin: 0 }}>
          Moderator Verdict
        </h2>
        <ConfidenceBadge level={conclusion.confidence} />
      </div>

      {conclusion.confidence_reason && (
        <p style={{ fontSize: 13, color: "#6366f1", marginBottom: 16, fontStyle: "italic" }}>
          {conclusion.confidence_reason}
        </p>
      )}

      <Section title="Summary" text={conclusion.summary} />
      {conclusion.consensus && <Section title="Consensus" text={conclusion.consensus} />}
      {conclusion.dissent && <Section title="Dissent" text={conclusion.dissent} color="#b45309" />}
      {conclusion.veto && <Section title="Veto" text={conclusion.veto} color="#dc2626" />}

      {conclusion.action_items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#6366f1", textTransform: "uppercase", marginBottom: 8 }}>
            Action Items
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {conclusion.action_items.map((item, i) => (
              <li key={i} style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, text, color = "#444" }: { title: string; text: string; color?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#6366f1", textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 14, color, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getPublicBundle(id);
  if (!bundle?.session) notFound();

  const { session, turns, conclusion } = bundle;

  const roundNumbers = [...new Set(turns.map((t) => t.round))].sort();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fafafa",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #ebebed", padding: "0 24px",
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fff",
      }}>
        <a href="/" style={{ fontWeight: 700, fontSize: 16, color: "#6366f1", textDecoration: "none" }}>
          Council
        </a>
        <span style={{ fontSize: 12, color: "#aaa", background: "#f5f5f7", border: "1px solid #ebebed", borderRadius: 20, padding: "3px 10px" }}>
          Shared Review
        </span>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111", marginBottom: 6, letterSpacing: "-0.02em" }}>
            {session.title}
          </h1>
          {session.topic && (
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, margin: 0 }}>{session.topic}</p>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <Meta label="Status" value={session.status} />
            <Meta label="Rounds" value={String(session.rounds)} />
            {session.concluded_at && (
              <Meta label="Concluded" value={new Date(session.concluded_at).toLocaleDateString()} />
            )}
          </div>
        </div>

        {/* Turns by round */}
        {roundNumbers.map((round) => (
          <div key={round} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: "#aaa", textTransform: "uppercase", marginBottom: 12,
              paddingBottom: 8, borderBottom: "1px solid #ebebed",
            }}>
              Round {round}
            </div>
            {turns.filter((t) => t.round === round).map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
          </div>
        ))}

        {/* Conclusion */}
        {conclusion && <ConclusionSection conclusion={conclusion} />}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #ebebed", textAlign: "center" }}>
          <a href="/analyze" style={{ fontSize: 14, color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
            Review your own paper →
          </a>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 12, color: "#888" }}>
      <span style={{ fontWeight: 600, color: "#555" }}>{label}:</span> {value}
    </span>
  );
}
