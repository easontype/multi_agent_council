import { NextRequest, NextResponse } from "next/server";
import { runCouncilSession } from "@/lib/core/council";
import type { CouncilEvent } from "@/lib/core/council-types";
import { isCouncilSessionOwner } from "@/lib/core/council-access";
import { checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { getSessionJob, registerSessionJob } from "@/lib/session-job-registry";
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

  const existingJob = getSessionJob(id);

  // Only consume quota + parse body when not already running.
  let options: {
    resume?: boolean;
    forceRestart?: boolean;
    staleAfterMs?: number;
    preferredLanguage?: string;
  } = {};

  if (!existingJob) {
    const quota = await checkEntitlement(req, "review_run");
    if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds);

    const accountCtx = await resolveAuthAccountContext();
    const preferredLanguage =
      accountCtx?.preferredLanguage && accountCtx.preferredLanguage !== "en"
        ? accountCtx.preferredLanguage
        : undefined;

    try {
      const body = await req.json();
      const staleAfterMinutes =
        typeof body?.staleAfterMinutes === "number"
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
  }

  // Get or start the background job — execution is decoupled from this HTTP connection.
  const job = existingJob ?? registerSessionJob(id, async (emit) => {
    const embedStart = Date.now();
    while (!(await isSessionEmbeddingReady(id))) {
      if (Date.now() - embedStart > EMBED_TIMEOUT_MS) break;
      emit({ type: "embedding_pending", elapsed: Math.round((Date.now() - embedStart) / 1000) });
      await new Promise<void>((r) => setTimeout(r, EMBED_POLL_MS));
    }
    await runCouncilSession(id, emit, options);
  });

  // SSE stream — subscribes to the background job's emitter.
  // When the client disconnects, the listener is removed but the job keeps running.
  const encoder = new TextEncoder();
  let activeSend: ((event: CouncilEvent) => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: CouncilEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client already disconnected; ignore write errors.
        }
      }
      activeSend = send;
      job.emitter.on("event", send);

      function cleanup() {
        job.emitter.off("event", send);
        activeSend = null;
        try { controller.close(); } catch { /* already closed */ }
      }

      job.emitter.once("close", cleanup);
      void job.promise.then(cleanup);
    },

    cancel() {
      // Client disconnected — remove the event listener so we don't leak it.
      // The background job continues running and will be available for the next reconnect.
      if (activeSend) {
        job.emitter.off("event", activeSend);
        activeSend = null;
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
