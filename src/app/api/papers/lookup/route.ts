import { NextRequest, NextResponse } from "next/server";
import { getPaperAssetLookupByArxivId } from "@/lib/paper-assets";

export async function GET(req: NextRequest) {
  const arxivId = req.nextUrl.searchParams.get("arxivId")?.trim() ?? "";
  if (!arxivId) {
    return NextResponse.json({ error: "arxivId is required" }, { status: 400 });
  }

  const lookup = await getPaperAssetLookupByArxivId(arxivId);
  if (!lookup) {
    return NextResponse.json({
      status: "unknown",
      paperAssetId: null,
      title: null,
      markerProcessed: false,
      sessionCount: 0,
    });
  }

  return NextResponse.json(lookup);
}
