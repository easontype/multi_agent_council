import { NextRequest, NextResponse } from "next/server";
import { getCouncilSessionBundle } from "@/lib/council";
import { canAccessCouncilSession } from "@/lib/council-access";
import type {
  CouncilConclusion,
  CouncilEvidence,
  CouncilSeat,
  CouncilTurn,
} from "@/lib/council-types";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function truncate(text: string | null | undefined, max = 1200) {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
}

function formatSeatMarkdown(seats: CouncilSeat[]): string {
  if (!seats.length) return "";

  const parts: string[] = ["## Reviewer Panel\n"];
  for (const seat of seats) {
    parts.push(`- **${seat.role}**`);
    parts.push(`  - Model: \`${seat.model}\``);
    if (seat.bias) parts.push(`  - Bias: ${seat.bias}`);
    if (seat.tools?.length) parts.push(`  - Tools: ${seat.tools.join(", ")}`);
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
    parts.push(`## Round ${round}\n`);
    for (const turn of roundTurns) {
      parts.push(`### ${turn.role}`);
      parts.push(`- Model: \`${turn.model}\``);
      if (turn.input_tokens || turn.output_tokens) {
        parts.push(`- Tokens: ${turn.input_tokens} in / ${turn.output_tokens} out`);
      }
      parts.push("");
      parts.push(turn.content.trim());
      parts.push("");
    }
  }
  return parts.join("\n");
}

function formatConclusionMarkdown(conclusion: CouncilConclusion): string {
  const lines: string[] = ["## Editorial Synthesis\n"];
  if (conclusion.confidence) {
    lines.push(
      `**Confidence:** ${conclusion.confidence}${conclusion.confidence_reason ? ` (${conclusion.confidence_reason})` : ""}\n`,
    );
  }
  lines.push(`### Summary Judgment\n\n${conclusion.summary.trim()}\n`);
  if (conclusion.consensus) lines.push(`### Consensus View\n\n${conclusion.consensus.trim()}\n`);
  if (conclusion.dissent?.length) {
    lines.push("### Unresolved Disagreements\n");
    for (const d of conclusion.dissent) {
      lines.push(`**${d.question}**`);
      for (const [seat, position] of Object.entries(d.seats)) {
        lines.push(`- **${seat}:** ${position}`);
      }
      lines.push("");
    }
  }
  if (conclusion.veto) lines.push(`### Blocking Concern\n\n${conclusion.veto.trim()}\n`);
  if (conclusion.action_items.length) {
    lines.push("### Revision Checklist\n");
    for (const item of conclusion.action_items) {
      lines.push(`- [${item.priority.toUpperCase()}] ${item.action}`);
    }
    lines.push("");
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

  const lines: string[] = [
    `# Council Review: ${session.title}`,
    "",
    "Academic peer-review export optimized for Markdown-first research workflows.",
    "",
    `**Date:** ${date}  `,
    `**Status:** ${session.status}  `,
    `**Rounds:** ${session.rounds}  `,
    `**Shared:** ${session.is_public ? "public" : "private"}  `,
    "",
    "---",
    "",
  ];

  if (session.topic) {
    lines.push(`## Topic\n\n${session.topic.trim()}\n`);
  }

  lines.push(formatSeatMarkdown(session.seats));

  if (conclusion) {
    lines.push(formatConclusionMarkdown(conclusion));
  }

  if (turns.length) {
    lines.push("---\n");
    lines.push("## Debate Record\n");
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
