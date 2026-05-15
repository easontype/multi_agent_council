import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCouncilSession, listSessions } from "@/lib/core/council";
import { ensureAccountContextForAuthUser, resolveAuthAccountContext } from "@/lib/auth-account";
import { getPaperAssetByIdForOwner } from "@/lib/paper-assets";
import {
  attachCouncilSessionCookie,
  createCouncilAnonymousAccess,
} from "@/lib/core/council-access";
import { applyEntitlementResponse, checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { DEFAULT_GEMMA_MODEL } from "@/lib/llm/gemma-models";
import { validateUserSystemPrompt, sanitizeUserInput, toSafeError } from "@/lib/utils/text";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";

export const GET = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await ensureAccountContextForAuthUser(req.auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account email required" }, { status: 403 });
  }

  const sessions = await listSessions({
    workspaceId: account.workspaceId,
    ownerUserEmail: account.email,
  });
  return NextResponse.json(sessions);
});

export async function POST(req: NextRequest) {
  try {
    const account = await resolveAuthAccountContext();
    const anonymousVisitor = account ? null : ensureAnonymousVisitorIdentity(req);
    const quota = await checkEntitlement(req, "review_create", anonymousVisitor ?? undefined);
    if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds, quota.anonymousVisitorIdToSet);

    const raw = await req.json() as Record<string, unknown>;
    const anonymousAccess = account ? null : createCouncilAnonymousAccess();

    // Whitelist only safe client-supplied fields — never trust model, moderator_model, or preferredModel from client
    const safeInput = {
      title:        typeof raw.title === "string"        ? raw.title.slice(0, 200)        : undefined,
      topic:        typeof raw.topic === "string"        ? raw.topic.slice(0, 500)        : "",
      context:      typeof raw.context === "string"      ? raw.context.slice(0, 3000)     : undefined,
      goal:         typeof raw.goal === "string"         ? raw.goal.slice(0, 500)         : undefined,
      paperAssetId: typeof raw.paperAssetId === "string" ? raw.paperAssetId               : undefined,
      rounds:       typeof raw.rounds === "number"       ? raw.rounds                     : undefined,
      autoPlan:     typeof raw.autoPlan === "boolean"    ? raw.autoPlan                   : undefined,
      maxSeats:     typeof raw.maxSeats === "number"     ? Math.min(Math.max(1, raw.maxSeats), 6) : undefined,
      debate_mode:  raw.debate_mode === "adversarial"    ? ("adversarial" as const)       : ("critique" as const),
        // Validate custom seat prompts for injection patterns before processing.
      // This runs before the map so we can return early on a bad seat.
      ...(Array.isArray(raw.seats) && (() => {
        for (const s of raw.seats as Record<string, unknown>[]) {
          if (typeof s.systemPrompt === "string") {
            const check = validateUserSystemPrompt(s.systemPrompt);
            if (!check.ok) throw new Error(`Invalid seat systemPrompt: ${check.reason}`);
          }
          if (typeof s.bias === "string") {
            const check = validateUserSystemPrompt(s.bias);
            if (!check.ok) throw new Error(`Invalid seat bias: ${check.reason}`);
          }
        }
        return {};
      })()),
      // Force server-side model on each seat to prevent model-cost abuse.
      // systemPrompt and bias are validated for injection patterns before use.
      seats: Array.isArray(raw.seats)
        ? (raw.seats as Record<string, unknown>[]).map((s) => ({
            role:         typeof s.role === "string"         ? s.role.slice(0, 80)           : "",
            model:        DEFAULT_GEMMA_MODEL,
            systemPrompt: typeof s.systemPrompt === "string" ? sanitizeUserInput(s.systemPrompt, 1000) : "",
            bias:         typeof s.bias === "string"         ? sanitizeUserInput(s.bias, 200)           : undefined,
            tools:        Array.isArray(s.tools) ? (s.tools as string[]).filter((t) => typeof t === "string") : undefined,
            library_id:   typeof s.library_id === "string"  ? s.library_id                  : undefined,
            team:         typeof s.team === "string"         ? s.team                        : undefined,
          }))
        : undefined,
    };

    if (safeInput.paperAssetId) {
      const asset = await getPaperAssetByIdForOwner(safeInput.paperAssetId, {
        workspaceId: account?.workspaceId,
        ownerUserEmail: account?.email ?? undefined,
        anonymousIdHash: anonymousVisitor?.idHash,
      });
      if (!asset) {
        return applyEntitlementResponse(
          NextResponse.json({ error: "Paper asset not found" }, { status: 404 }),
          quota,
        );
      }
    }

    const session = await createCouncilSession({
      ...safeInput,
      workspaceId:      account?.workspaceId,
      createdByUserId:  account?.userId,
      ownerUserEmail:   account?.email ?? undefined,
      accessTokenHash:  anonymousAccess?.tokenHash,
    });

    const response = NextResponse.json({ id: session.id }, { status: 201 });
    if (anonymousAccess) {
      attachCouncilSessionCookie(response, session.id, anonymousAccess.plaintextToken);
    }

    return applyEntitlementResponse(response, quota);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Invalid seat")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: toSafeError(error, "session create") }, { status: 500 });
  }
}
