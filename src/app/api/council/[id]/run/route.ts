import { NextRequest } from "next/server";
import { runCouncilSession, type CouncilEvent } from "@/lib/council";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let options: { resume?: boolean; forceRestart?: boolean; staleAfterMs?: number } = {};
  try {
    const body = await req.json();
    const staleAfterMinutes = typeof body?.staleAfterMinutes === "number"
      ? body.staleAfterMinutes
      : Number(body?.staleAfterMinutes ?? 0) || undefined;
    options = {
      resume: body?.resume,
      forceRestart: body?.forceRestart,
      staleAfterMs: staleAfterMinutes ? staleAfterMinutes * 60_000 : undefined,
    };
  } catch {
    options = {};
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: CouncilEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }

      try {
        await runCouncilSession(id, send, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
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
