import { NextRequest, NextResponse } from "next/server";
import { runCouncilSession, type CouncilEvent } from "@/lib/core/council";
import { isCouncilSessionOwner } from "@/lib/core/council-access";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { db } from "@/lib/db/db";

const EMBED_POLL_MS = 3_500;
const EMBED_TIMEOUT_MS = 120_000;

async function isSessionEmbeddingReady(sessionId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT
       CASE
         WHEN cs.paper_asset_id IS NULL THEN true
         WHEN d.id IS NULL THEN false
         ELSE COALESCE(d.done, false)
       END AS ready
     FROM council_sessions cs
     LEFT JOIN paper_assets pa ON pa.id = cs.paper_asset_id
     LEFT JOIN documents d ON d.id = pa.document_id
     WHERE cs.id = $1
     LIMIT 1`,
    [sessionId],
  );
  if (!rows.length) return true;
  return Boolean((rows[0] as { ready: boolean }).ready);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isOwner = await isCouncilSessionOwner(req, id);
  if (!isOwner) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const quota = await enforceAnonymousWebQuota(req, "review_run", [
    { limit: 10, windowSeconds: 10 * 60, label: "10 minutes" },
  ]);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.error },
      {
        status: 429,
        headers: quota.retryAfterSeconds
          ? { "Retry-After": String(quota.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const accountCtx = await resolveAuthAccountContext()
  const preferredLanguage = accountCtx?.preferredLanguage && accountCtx.preferredLanguage !== 'en'
    ? accountCtx.preferredLanguage
    : undefined

  let options: { resume?: boolean; forceRestart?: boolean; staleAfterMs?: number; preferredLanguage?: string } = {};
  try {
    const body = await req.json();
    const staleAfterMinutes = typeof body?.staleAfterMinutes === "number"
      ? body.staleAfterMinutes
      : Number(body?.staleAfterMinutes ?? 0) || undefined;
    options = {
      resume: body?.resume,
      forceRestart: body?.forceRestart,
      staleAfterMs: staleAfterMinutes ? staleAfterMinutes * 60_000 : undefined,
      preferredLanguage,
    };
  } catch {
    options = { preferredLanguage };
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: CouncilEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }

      try {
        // Wait for embedding to be ready before starting debate
        const embedStart = Date.now();
        while (!(await isSessionEmbeddingReady(id))) {
          if (Date.now() - embedStart > EMBED_TIMEOUT_MS) break;
          send({ type: "embedding_pending", elapsed: Math.round((Date.now() - embedStart) / 1000) });
          await new Promise<void>((r) => setTimeout(r, EMBED_POLL_MS));
        }

        await runCouncilSession(id, send, options);
      } catch {
        // runCouncilSession already emits a typed error event before rethrowing.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
