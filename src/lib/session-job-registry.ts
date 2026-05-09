/**
 * In-process session job registry.
 *
 * Tracks sessions that are currently being run by the agentic runtime so that:
 *  1. A reconnecting SSE client can subscribe to an already-running job.
 *  2. A second POST /run request for the same session is a no-op (prevents duplicate execution).
 *
 * The registry is in-memory and scoped to the Node.js process. It survives across individual
 * HTTP requests (which is the key property we need), but NOT across server restarts or multiple
 * processes (Vercel serverless instances). For multi-process durability a proper job queue
 * (pg-boss / BullMQ) would be needed; this covers the common single-server case.
 */

import { EventEmitter } from "events";
import type { CouncilEvent } from "./core/council-types";

export interface SessionJob {
  emitter: EventEmitter;
  promise: Promise<void>;
  startedAt: number;
}

// Singleton Map — persists for the lifetime of the Node.js process.
const registry = new Map<string, SessionJob>();

const LINGER_MS = 60_000;

export function getSessionJob(sessionId: string): SessionJob | undefined {
  return registry.get(sessionId);
}

export function registerSessionJob(
  sessionId: string,
  execute: (emit: (event: CouncilEvent) => void) => Promise<void>,
): SessionJob {
  const existing = registry.get(sessionId);
  if (existing) return existing;

  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);

  const promise = execute((event) => {
    emitter.emit("event", event);
    if (event.type === "session_done" || event.type === "error") {
      emitter.emit("close");
    }
  }).catch((err) => {
    emitter.emit("event", { type: "error", message: String(err) } satisfies CouncilEvent);
    emitter.emit("close");
  }).finally(() => {
    setTimeout(() => registry.delete(sessionId), LINGER_MS);
  });

  const job: SessionJob = { emitter, promise, startedAt: Date.now() };
  registry.set(sessionId, job);
  return job;
}

export function removeSessionJob(sessionId: string): void {
  registry.delete(sessionId);
}
