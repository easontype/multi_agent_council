import { NextRequest, NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";
import { applyEntitlementResponse } from "@/lib/entitlements";
import { getPaperAssetLookupByArxivId } from "@/lib/paper-assets";

export async function GET(req: NextRequest) {
  const account = await resolveAuthAccountContext();
  const anonymousVisitor = account ? null : ensureAnonymousVisitorIdentity(req);
  const arxivId = req.nextUrl.searchParams.get("arxivId")?.trim() ?? "";
  if (!arxivId) {
    return applyEntitlementResponse(
      NextResponse.json({ error: "arxivId is required" }, { status: 400 }),
      { anonymousVisitorIdToSet: anonymousVisitor?.needsSetCookie ? anonymousVisitor.plaintextId : undefined },
    );
  }

  const lookup = await getPaperAssetLookupByArxivId(arxivId, {
    workspaceId: account?.workspaceId,
    ownerUserEmail: account?.email ?? undefined,
    anonymousIdHash: anonymousVisitor?.idHash,
  });
  if (!lookup) {
    return applyEntitlementResponse(NextResponse.json({
      status: "unknown",
      paperAssetId: null,
      title: null,
      markerProcessed: false,
      sessionCount: 0,
    }), { anonymousVisitorIdToSet: anonymousVisitor?.needsSetCookie ? anonymousVisitor.plaintextId : undefined });
  }

  return applyEntitlementResponse(
    NextResponse.json(lookup),
    { anonymousVisitorIdToSet: anonymousVisitor?.needsSetCookie ? anonymousVisitor.plaintextId : undefined },
  );
}
