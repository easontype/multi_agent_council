import { NextRequest, NextResponse } from "next/server";
import { getCouncilSessionBundle } from "@/lib/core/council";
import { canAccessCouncilSession } from "@/lib/core/council-access";
import type {
  CouncilConclusion,
  CouncilEvidence,
  CouncilSeat,
  CouncilSession,
  CouncilTurn,
} from "@/lib/core/council-types";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function truncate(text: string | null | undefined, max = 1200) {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
}

const DECISION_EMOJI: Record<string, string> = {
  "Accept": "✅",
  "Minor Revision": "🟡",
  "Major Revision": "🔴",
  "Reject": "⛔",
};

function formatSeatMarkdown(session: CouncilSession): string {
  if (!session.seats.length) return "";
  const isAdversarial = session.debate_mode === "adversarial";
  const parts: string[] = ["## Reviewer Panel\n"];

  if (isAdversarial) {
    const teams = new Map<string, CouncilSeat[]>();
    for (const seat of session.seats) {
      const key = seat.team ?? "unassigned";
      if (!teams.has(key)) teams.set(key, []);
      teams.get(key)!.push(seat);
    }
    for (const [team, seats] of teams) {
      parts.push(`### Team: ${team}\n`);
      for (const seat of seats) {
        parts.push(`- **${seat.role}**`);
      }
      parts.push("");
    }
  } else {
    for (const seat of session.seats) {
      parts.push(`- **${seat.role}** — ${seat.bias ?? ""}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

function formatTurnsMarkdown(turns: CouncilTurn[]): string {
  const byRound = new Map<number, CouncilTurn[]>();
  for (const t of turns) {
    if (!byRound.has(t.round)) byRound.set(t.round, []);
    byRound.get(t.round)!.push(t);
  }

  const parts: string[] = [];
  for (const [round, roundTurns] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
    parts.push(`### Round ${round}\n`);
    for (const turn of roundTurns) {
      parts.push(`#### ${turn.role}`);
      parts.push("");
      parts.push(turn.content.trim());
      parts.push("");
    }
  }
  return parts.join("\n");
}

function formatCritiqueConclusion(conclusion: CouncilConclusion): string {
  const lines: string[] = [];

  // ── Editorial Decision ───────────────────────────────────────────────────────
  if (conclusion.editorial_decision) {
    const emoji = DECISION_EMOJI[conclusion.editorial_decision] ?? "";
    lines.push(`## Editorial Decision\n`);
    lines.push(`**${emoji} ${conclusion.editorial_decision}**\n`);
    if (conclusion.editorial_rationale) {
      lines.push(`${conclusion.editorial_rationale.trim()}\n`);
    }
    lines.push("---\n");
  }

  lines.push(`## Summary\n\n${conclusion.summary.trim()}\n`);

  // ── Questions to Prepare ────────────────────────────────────────────────────
  if (conclusion.questions?.length) {
    lines.push("## Questions to Prepare Before Submission\n");
    conclusion.questions.forEach((q, i) => {
      lines.push(`### Q${i + 1}: ${q.question}\n`);
      lines.push(`**Raised by:** ${q.raised_by}`);
      if (q.literature) lines.push(`**Literature:** ${q.literature}`);
      lines.push(`**Suggested action:** ${q.suggestion}`);
      lines.push("");
    });
  }

  // ── Unresolved Disagreements ────────────────────────────────────────────────
  if (conclusion.dissent?.length) {
    lines.push("## Unresolved Disagreements\n");
    for (const d of conclusion.dissent) {
      lines.push(`### ${d.question}\n`);
      if (Object.keys(d.seats).length) {
        lines.push("| Seat | Position |");
        lines.push("|---|---|");
        for (const [seat, position] of Object.entries(d.seats)) {
          lines.push(`| ${seat} | ${position} |`);
        }
        lines.push("");
      }
      if (d.resolution_path) {
        lines.push(`**Resolution path:** ${d.resolution_path}\n`);
      }
    }
  }

  // ── Blocking Concern ─────────────────────────────────────────────────────────
  if (conclusion.veto) {
    lines.push(`## Blocking Concern\n\n> ${conclusion.veto.trim()}\n`);
  }

  // ── Revision Checklist ───────────────────────────────────────────────────────
  if (conclusion.action_items.length) {
    lines.push("## Revision Checklist\n");
    for (const item of conclusion.action_items) {
      const tag = item.priority === "blocking" ? "🔴" : item.priority === "recommended" ? "🟡" : "⚪";
      lines.push(`- ${tag} ${item.action}`);
    }
    lines.push("");
  }

  // ── Confidence ───────────────────────────────────────────────────────────────
  if (conclusion.confidence) {
    lines.push(`---\n\n**Reviewer Confidence:** ${conclusion.confidence}${conclusion.confidence_reason ? ` — ${conclusion.confidence_reason}` : ""}\n`);
  }

  return lines.join("\n");
}

function formatAdversarialConclusion(conclusion: CouncilConclusion): string {
  const lines: string[] = [];

  if (conclusion.winning_team) {
    const isDraw = conclusion.winning_team === "draw";
    lines.push(`## Verdict\n`);
    lines.push(isDraw ? `**Draw** — Neither team established a clear advantage.\n` : `**Winner: ${conclusion.winning_team}**\n`);
    lines.push(`${conclusion.summary.trim()}\n`);
    lines.push("---\n");
  } else {
    lines.push(`## Summary\n\n${conclusion.summary.trim()}\n`);
  }

  if (conclusion.dissent?.length) {
    lines.push("## Unresolved Points\n");
    for (const d of conclusion.dissent) {
      lines.push(`### ${d.question}\n`);
      if (Object.keys(d.seats).length) {
        lines.push("| Team / Seat | Position |");
        lines.push("|---|---|");
        for (const [seat, position] of Object.entries(d.seats)) {
          lines.push(`| ${seat} | ${position} |`);
        }
        lines.push("");
      }
    }
  }

  if (conclusion.action_items.length) {
    lines.push("## Follow-up Items\n");
    for (const item of conclusion.action_items) {
      lines.push(`- [${item.priority.toUpperCase()}] ${item.action}`);
    }
    lines.push("");
  }

  if (conclusion.confidence) {
    lines.push(`---\n\n**Moderator Confidence:** ${conclusion.confidence}${conclusion.confidence_reason ? ` — ${conclusion.confidence_reason}` : ""}\n`);
  }

  return lines.join("\n");
}

function formatEvidenceMarkdown(evidence: CouncilEvidence[]): string {
  if (!evidence.length) return "";

  const parts: string[] = ["## Evidence Appendix\n"];
  for (const item of evidence) {
    parts.push(`### Round ${item.round} - ${item.role}`);
    parts.push(`- Tool: \`${item.tool}\``);
    parts.push(`- Status: ${item.status}`);
    parts.push(`- Runtime: ${item.runtime_class}`);

    const args = JSON.stringify(item.args ?? {}, null, 2);
    if (args && args !== "{}") {
      parts.push("- Arguments:");
      parts.push("```json");
      parts.push(args);
      parts.push("```");
    }

    if (item.result?.trim()) {
      parts.push("- Result:");
      parts.push("");
      parts.push(truncate(item.result, 1800));
      parts.push("");
    }

    if (item.source_refs.length) {
      parts.push("- Sources:");
      for (const ref of item.source_refs) {
        const label = ref.uri ? `[${ref.label}](${ref.uri})` : ref.label;
        parts.push(`  - ${label}`);
        if (ref.snippet) parts.push(`    - ${truncate(ref.snippet, 260)}`);
      }
    }

    parts.push("");
  }
  return parts.join("\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const allowed = await canAccessCouncilSession(req, id);
  if (!allowed) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { session, turns, conclusion, evidence } = await getCouncilSessionBundle(id);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const date = session.concluded_at
    ? new Date(session.concluded_at).toISOString().slice(0, 10)
    : new Date(session.created_at).toISOString().slice(0, 10);

  const isAdversarial = session.debate_mode === "adversarial";
  const decisionLabel = conclusion?.editorial_decision
    ? ` | ${DECISION_EMOJI[conclusion.editorial_decision] ?? ""} ${conclusion.editorial_decision}`
    : "";

  const lines: string[] = [
    `# Council Review: ${session.title}`,
    "",
    `**Date:** ${date}${decisionLabel}  `,
    `**Mode:** ${isAdversarial ? "Adversarial Debate" : "Peer Review"}  `,
    `**Rounds:** ${session.rounds}  `,
    "",
    "---",
    "",
  ];

  if (session.topic) {
    lines.push(`## Topic\n\n${session.topic.trim()}\n`);
  }

  lines.push(formatSeatMarkdown(session));

  if (conclusion) {
    lines.push(isAdversarial
      ? formatAdversarialConclusion(conclusion)
      : formatCritiqueConclusion(conclusion));
  }

  if (turns.length) {
    lines.push("---\n");
    lines.push("## Debate Record (Appendix)\n");
    lines.push(formatTurnsMarkdown(turns));
  }

  if (evidence.length) {
    lines.push("---\n");
    lines.push(formatEvidenceMarkdown(evidence));
  }

  const markdown = lines.join("\n");
  const filename = `council-${slugify(session.title)}-${date}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
