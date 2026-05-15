import { NextRequest, NextResponse } from "next/server";
import { getPaperAssetById } from "@/lib/paper-assets";
import { buildAcademicCritiqueSeats, buildGapAnalysisSeats, BIOMEDICAL_SEAT_DEFINITIONS, PHYSICS_SEAT_DEFINITIONS, EXPERIMENTAL_SEAT_DEFINITIONS } from "@/lib/core/council-academic";
import { buildAdversarialTeam } from "@/lib/prompts/debate-presets";
import type { ReviewDomain } from "@/lib/prompts/review-presets";
import { createCouncilSession } from "@/lib/core/council";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { createCouncilAnonymousAccess, attachCouncilSessionCookie } from "@/lib/core/council-access";
import { checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { DEFAULT_GEMMA_MODEL } from "@/lib/llm/gemma-models";
import { resolvePaperTopicSelection } from "@/lib/paper-topics";
import type { CouncilSeat } from "@/lib/core/council-types";
import { validateUserSystemPrompt, toSafeError } from "@/lib/utils/text";

const DOMAIN_SEATS: Record<string, ((model: string) => CouncilSeat[]) | undefined> = {
  general: (model) => buildAcademicCritiqueSeats(model),
  materials: (model) => buildExperimentalSeats(model),
  biomedical: (model) => buildBiomedicalSeats(model),
  physics: (model) => buildPhysicsSeats(model),
};

function buildExperimentalSeats(model: string): CouncilSeat[] {
  return EXPERIMENTAL_SEAT_DEFINITIONS.map((def) => ({
    role: def.role,
    systemPrompt: def.systemPrompt,
    bias: def.bias,
    tools: def.tools,
    model: def.modelOverride ?? model,
  }));
}

function buildBiomedicalSeats(model: string): CouncilSeat[] {
  return BIOMEDICAL_SEAT_DEFINITIONS.map((def) => ({
    role: def.role,
    systemPrompt: def.systemPrompt,
    bias: def.bias,
    tools: def.tools,
    model: def.modelOverride ?? model,
  }));
}

function buildPhysicsSeats(model: string): CouncilSeat[] {
  return PHYSICS_SEAT_DEFINITIONS.map((def) => ({
    role: def.role,
    systemPrompt: def.systemPrompt,
    bias: def.bias,
    tools: def.tools,
    model: def.modelOverride ?? model,
  }));
}

/**
 * POST /api/sessions/from-asset
 *
 * Creates a council session from an already-ingested paper asset.
 * Used by /review/setup/[assetId] and /debate/setup/[assetId].
 *
 * Input (JSON):
 *   paperAssetId: string
 *   mode: 'critique' | 'gap'          (review only)
 *   rounds: 1 | 2
 *   domain?: 'general' | 'materials' | 'biomedical' | 'physics'
 *   sessionType?: 'review' | 'debate'
 *   optionA?: string                   (debate only — side A label)
 *   optionB?: string                   (debate only — side B label)
 *   context?: string                   (debate only — framing context)
 *   selectedRoleIds?: string[]         (debate only — which roles to include)
 *
 * Output: { sessionId, paperTitle, paperAbstract }
 */
export async function POST(req: NextRequest) {
  const quota = await checkEntitlement(req, "review_run");
  if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paperAssetId = typeof body.paperAssetId === "string" ? body.paperAssetId.trim() : "";
  if (!paperAssetId) {
    return NextResponse.json({ error: "paperAssetId is required" }, { status: 400 });
  }

  const sessionType: "review" | "debate" = body.sessionType === "debate" ? "debate" : "review";
  const mode: "critique" | "gap" = body.mode === "gap" ? "gap" : "critique";
  const rounds: 1 | 2 = body.rounds === 2 ? 2 : 1;
  const domain = (typeof body.domain === "string" ? body.domain : "general") as ReviewDomain;

  const asset = await getPaperAssetById(paperAssetId);
  if (!asset) {
    return NextResponse.json({ error: "Paper asset not found" }, { status: 404 });
  }

  const libraryId = asset.primary_library_id;
  if (!libraryId) {
    return NextResponse.json({ error: "Paper is still being processed — try again in a moment" }, { status: 409 });
  }

  const paperTitle = asset.canonical_title;
  const paperAbstract = asset.abstract ?? "";
  const sourceUrl = asset.arxiv_id ? `https://arxiv.org/abs/${asset.arxiv_id}` : "upload";

  let seats: CouncilSeat[];
  let topic: string;
  let goal: string;

  if (sessionType === "debate") {
    const rawA = typeof body.optionA === "string" ? body.optionA.trim() : "Support";
    const rawB = typeof body.optionB === "string" ? body.optionB.trim() : "Challenge";
    const rawContext = typeof body.context === "string" ? body.context.trim() : "";

    if (rawA.length > 200)
      return NextResponse.json({ error: "optionA must be 200 characters or fewer" }, { status: 422 });
    if (rawB.length > 200)
      return NextResponse.json({ error: "optionB must be 200 characters or fewer" }, { status: 422 });
    if (rawContext.length > 1000)
      return NextResponse.json({ error: "context must be 1000 characters or fewer" }, { status: 422 });

    const optACheck = validateUserSystemPrompt(rawA);
    if (!optACheck.ok) return NextResponse.json({ error: `Invalid optionA: ${optACheck.reason}` }, { status: 422 });
    const optBCheck = validateUserSystemPrompt(rawB);
    if (!optBCheck.ok) return NextResponse.json({ error: `Invalid optionB: ${optBCheck.reason}` }, { status: 422 });
    const ctxCheck = validateUserSystemPrompt(rawContext);
    if (!ctxCheck.ok) return NextResponse.json({ error: `Invalid context: ${ctxCheck.reason}` }, { status: 422 });

    // Pass raw values — buildAdversarialTeam() applies sanitizeUserInput() internally.
    const optionA = rawA;
    const optionB = rawB;
    const context = rawContext;

    const selectedRoleIds = Array.isArray(body.selectedRoleIds)
      ? (body.selectedRoleIds as unknown[]).filter(x => typeof x === "string") as string[]
      : [];

    const rawSeats = buildAdversarialTeam({ optionA, optionB, context, domain, selectedRoleIds });
    seats = rawSeats.map((seat) => ({ ...seat, library_id: libraryId }));
    topic = `${optionA} vs ${optionB}`;
    goal = context || `Compare ${optionA} and ${optionB} — which is better supported by the literature?`;
  } else {
    const topicSelection = resolvePaperTopicSelection({ topicPresetId: "methodology" });
    const seatFactory = DOMAIN_SEATS[domain] ?? DOMAIN_SEATS.general!;
    const rawSeats = mode === "gap" ? buildGapAnalysisSeats(DEFAULT_GEMMA_MODEL) : seatFactory(DEFAULT_GEMMA_MODEL);
    seats = rawSeats.map((seat) => ({ ...seat, library_id: libraryId }));
    topic = topicSelection.topic;
    goal = topicSelection.goal || (mode === "gap"
      ? "Identify research gaps, missing elements, and opportunities for improvement."
      : "Provide rigorous multi-perspective academic critique.");
  }

  const account = await resolveAuthAccountContext();
  const anonymousAccess = account ? null : createCouncilAnonymousAccess();

  let sessionId: string;
  try {
    const session = await createCouncilSession({
      title: paperTitle,
      topic,
      context: `Source: ${sourceUrl}. Library: ${libraryId}`,
      goal,
      paperAssetId,
      seats,
      rounds,
      workspaceId: account?.workspaceId,
      createdByUserId: account?.userId,
      ownerUserEmail: account?.email ?? undefined,
      accessTokenHash: anonymousAccess?.tokenHash,
    });
    sessionId = session.id;
  } catch (err) {
    return NextResponse.json({ error: toSafeError(err, 'session from-asset create') }, { status: 500 });
  }

  const response = NextResponse.json({ sessionId, paperTitle, paperAbstract }, { status: 201 });
  if (anonymousAccess) {
    attachCouncilSessionCookie(response, sessionId, anonymousAccess.plaintextToken);
  }
  return response;
}
