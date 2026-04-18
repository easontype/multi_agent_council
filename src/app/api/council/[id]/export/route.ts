import { NextRequest, NextResponse } from "next/server";
import { getCouncilSessionBundle } from "@/lib/council";
import { canAccessCouncilSession } from "@/lib/council-access";
import type { CouncilTurn, CouncilConclusion } from "@/lib/council-types";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
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
      parts.push(`### ${turn.role}\n\n${turn.content.trim()}\n`);
    }
  }
  return parts.join("\n");
}

function formatConclusionMarkdown(c: CouncilConclusion): string {
  const lines: string[] = ["## Moderator Verdict\n"];
  if (c.confidence) lines.push(`**Confidence:** ${c.confidence}${c.confidence_reason ? ` — ${c.confidence_reason}` : ""}\n`);
  lines.push(`### Summary\n\n${c.summary.trim()}\n`);
  if (c.consensus) lines.push(`### Consensus\n\n${c.consensus.trim()}\n`);
  if (c.dissent) lines.push(`### Dissent\n\n${c.dissent.trim()}\n`);
  if (c.veto) lines.push(`### Veto\n\n${c.veto.trim()}\n`);
  if (c.action_items.length) {
    lines.push(`### Action Items\n`);
    for (const item of c.action_items) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const allowed = await canAccessCouncilSession(req, id);
  if (!allowed) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { session, turns, conclusion } = await getCouncilSessionBundle(id);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const date = session.concluded_at
    ? new Date(session.concluded_at).toISOString().slice(0, 10)
    : new Date(session.created_at).toISOString().slice(0, 10);

  const lines: string[] = [
    `# Council Review: ${session.title}`,
    ``,
    `**Date:** ${date}  `,
    `**Status:** ${session.status}  `,
    `**Rounds:** ${session.rounds}  `,
    ``,
    `---`,
    ``,
  ];

  if (session.topic) {
    lines.push(`## Topic\n\n${session.topic.trim()}\n`);
  }

  if (turns.length) {
    lines.push(formatTurnsMarkdown(turns));
  }

  if (conclusion) {
    lines.push("---\n");
    lines.push(formatConclusionMarkdown(conclusion));
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
