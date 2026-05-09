import { enforceAnonymousWebQuota } from "./web-quota";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type EntitlementAction =
  | "review_create"
  | "review_run"
  | "web_analyze"
  | "paper_ingest"
  | "team_builder";

interface QuotaWindow {
  limit: number;
  windowSeconds: number;
  label: string;
}

const LIMITS: Record<EntitlementAction, QuotaWindow[]> = {
  review_create: [
    { limit: 3,  windowSeconds: 10 * 60,       label: "10 minutes" },
    { limit: 10, windowSeconds: 24 * 60 * 60,  label: "day" },
  ],
  review_run: [
    { limit: 10, windowSeconds: 10 * 60,       label: "10 minutes" },
  ],
  web_analyze: [
    { limit: 3,  windowSeconds: 10 * 60,       label: "10 minutes" },
    { limit: 10, windowSeconds: 24 * 60 * 60,  label: "day" },
  ],
  paper_ingest: [
    { limit: 6,  windowSeconds: 10 * 60,       label: "10 minutes" },
    { limit: 15, windowSeconds: 24 * 60 * 60,  label: "day" },
  ],
  team_builder: [
    { limit: 6,  windowSeconds: 10 * 60,       label: "10 minutes" },
    { limit: 30, windowSeconds: 24 * 60 * 60,  label: "day" },
  ],
};

export async function checkEntitlement(req: NextRequest, action: EntitlementAction) {
  return enforceAnonymousWebQuota(req, action, LIMITS[action]);
}

export function quotaDenied(
  error: string | undefined,
  retryAfterSeconds: number | undefined,
): NextResponse {
  return NextResponse.json(
    { error: error ?? "Rate limit exceeded" },
    {
      status: 429,
      headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
    },
  );
}
