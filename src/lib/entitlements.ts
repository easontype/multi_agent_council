import { enforceAnonymousWebQuota } from "./web-quota";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";
import type { AnonymousVisitorIdentity } from "@/lib/anonymous-access";
import { buildAnonymousVisitorSetCookie } from "@/lib/anonymous-access";

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

// Free tier: 10 reviews/week (~$0.34/month/user → 2.9% break-even conversion)
const FREE_LIMITS: Record<EntitlementAction, QuotaWindow[]> = {
  review_create: [
    { limit: 3,  windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 10, windowSeconds: 7 * 24 * 60 * 60,     label: "week" },
  ],
  review_run: [
    { limit: 10, windowSeconds: 10 * 60,              label: "10 minutes" },
  ],
  web_analyze: [
    { limit: 3,  windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 10, windowSeconds: 7 * 24 * 60 * 60,     label: "week" },
  ],
  paper_ingest: [
    { limit: 6,  windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 20, windowSeconds: 7 * 24 * 60 * 60,     label: "week" },
  ],
  team_builder: [
    { limit: 6,  windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 30, windowSeconds: 7 * 24 * 60 * 60,     label: "week" },
  ],
};

// Pro tier: 50 reviews/day
const PRO_LIMITS: Record<EntitlementAction, QuotaWindow[]> = {
  review_create: [
    { limit: 10, windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 50, windowSeconds: 24 * 60 * 60,         label: "day" },
  ],
  review_run: [
    { limit: 50, windowSeconds: 10 * 60,              label: "10 minutes" },
  ],
  web_analyze: [
    { limit: 10, windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 50, windowSeconds: 24 * 60 * 60,         label: "day" },
  ],
  paper_ingest: [
    { limit: 20, windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 100, windowSeconds: 24 * 60 * 60,        label: "day" },
  ],
  team_builder: [
    { limit: 20, windowSeconds: 10 * 60,              label: "10 minutes" },
    { limit: 100, windowSeconds: 24 * 60 * 60,        label: "day" },
  ],
};

export async function checkEntitlement(
  req: NextRequest,
  action: EntitlementAction,
  anonymousVisitor?: AnonymousVisitorIdentity,
) {
  const email = await getAuthenticatedCouncilOwnerEmail();
  let limits = FREE_LIMITS[action];
  if (email) {
    const tier = await getWorkspaceTierByEmail(email);
    if (tier === 'pro') limits = PRO_LIMITS[action];
  }
  return enforceAnonymousWebQuota(req, action, limits, anonymousVisitor);
}

export function quotaDenied(
  error: string | undefined,
  retryAfterSeconds: number | undefined,
  anonymousVisitorIdToSet?: string,
): NextResponse {
  const response = NextResponse.json(
    { error: error ?? "Rate limit exceeded" },
    {
      status: 429,
      headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
    },
  );
  return applyEntitlementResponse(response, { anonymousVisitorIdToSet });
}

export function applyEntitlementResponse<T extends Response>(
  response: T,
  quota: { anonymousVisitorIdToSet?: string },
): T {
  if (quota.anonymousVisitorIdToSet) {
    response.headers.append(
      "Set-Cookie",
      buildAnonymousVisitorSetCookie(quota.anonymousVisitorIdToSet),
    );
  }
  return response;
}
