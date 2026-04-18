import { notFound } from "next/navigation";
import { getCouncilSessionBundle } from "@/lib/council";
import { db } from "@/lib/db";
import type { CouncilConclusion, CouncilTurn } from "@/lib/council-types";

async function getPublicBundle(id: string) {
  const { rows } = await db.query(
    `SELECT is_public FROM council_sessions WHERE id = $1`,
    [id],
  );
  if (!rows.length || !(rows[0] as { is_public: boolean }).is_public) return null;
  return getCouncilSessionBundle(id);
}

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, string> = {
    high: "#3f6b52",
    medium: "#8b6b35",
    low: "#8a4545",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: colors[level] ?? "#71717a",
        border: `1px solid ${colors[level] ?? "#d4d4d8"}`,
        borderRadius: 999,
        padding: "2px 10px",
        textTransform: "capitalize",
      }}
    >
      {level} confidence
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 12, color: "#71717a" }}>
      <span style={{ fontWeight: 600, color: "#3f3f46" }}>{label}:</span> {value}
    </span>
  );
}

function Section({ title, text, color = "#444" }: { title: string; text: string; color?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#71717a",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 14, color, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

function ConclusionSection({ conclusion }: { conclusion: CouncilConclusion }) {
  return (
    <div
      style={{
        border: "1px solid #e8e6df",
        borderRadius: 16,
        padding: "24px 24px",
        background: "#fbfaf6",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#222", margin: 0 }}>Moderator Verdict</h2>
        <ConfidenceBadge level={conclusion.confidence} />
      </div>

      {conclusion.confidence_reason && (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, fontStyle: "italic" }}>
          {conclusion.confidence_reason}
        </p>
      )}

      <Section title="Summary" text={conclusion.summary} />
      {conclusion.consensus && <Section title="Consensus" text={conclusion.consensus} />}
      {conclusion.dissent && <Section title="Dissent" text={conclusion.dissent} color="#8b6b35" />}
      {conclusion.veto && <Section title="Veto" text={conclusion.veto} color="#8a4545" />}

      {conclusion.action_items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#71717a",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Action Items
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {conclusion.action_items.map((item, index) => (
              <li key={index} style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TurnCard({ turn }: { turn: CouncilTurn }) {
  return (
    <div
      style={{
        border: "1px solid #ececf1",
        borderRadius: 14,
        padding: "16px 18px",
        background: "#fff",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#5f6672",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {turn.role.charAt(0).toUpperCase()}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{turn.role}</span>
        <span style={{ fontSize: 11, color: "#a1a1aa", marginLeft: "auto" }}>Round {turn.round}</span>
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#444",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {turn.content}
      </div>
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
  const roundNumbers = [...new Set(turns.map((turn) => turn.round))].sort((a, b) => a - b);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fcfcfb",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <nav
        style={{
          borderBottom: "1px solid #ececf1",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
        }}
      >
        <a href="/" style={{ fontWeight: 700, fontSize: 16, color: "#374151", textDecoration: "none" }}>
          Council
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              color: "#71717a",
              background: "#f8f8f8",
              border: "1px solid #ececf1",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            Read-only share
          </span>
          <a
            href={`/api/council/${session.id}/export`}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#3f3f46",
              textDecoration: "none",
              border: "1px solid #e4e4e7",
              borderRadius: 999,
              padding: "6px 10px",
              background: "#fff",
            }}
          >
            Download Markdown
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#a1a1aa",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Shared Council Session
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#111",
              marginBottom: 8,
              letterSpacing: "-0.03em",
              fontFamily: "'Georgia', 'Times New Roman', serif",
            }}
          >
            {session.title}
          </h1>
          {session.topic && (
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, margin: 0 }}>{session.topic}</p>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <Meta label="Status" value={session.status} />
            <Meta label="Rounds" value={String(session.rounds)} />
            {session.concluded_at && (
              <Meta label="Concluded" value={new Date(session.concluded_at).toLocaleDateString()} />
            )}
          </div>
        </div>

        {conclusion && <ConclusionSection conclusion={conclusion} />}

        {roundNumbers.map((round) => (
          <div key={round} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#a1a1aa",
                textTransform: "uppercase",
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #ececf1",
              }}
            >
              Round {round}
            </div>
            {turns.filter((turn) => turn.round === round).map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #ebebed", textAlign: "center" }}>
          <a href="/analyze" style={{ fontSize: 14, color: "#4b5563", fontWeight: 600, textDecoration: "none" }}>
            Review your own paper
          </a>
        </div>
      </div>
    </div>
  );
}
