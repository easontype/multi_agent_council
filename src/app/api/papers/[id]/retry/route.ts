import { auth } from "@/auth";
import { ensureAccountContextForAuthUser } from "@/lib/auth-account";
import {
  getPaperAssetById,
  attachIngestedDocumentToPaperAsset,
  markPaperAssetProcessingFailed,
  markPaperAssetProcessingStarted,
  computeBufferChecksum,
} from "@/lib/paper-assets";
import { fetchArxivPaper, ingestPaper } from "@/lib/paper-ingest";
import { NextResponse } from "next/server";

export const POST = auth(async (req, { params }) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await ensureAccountContextForAuthUser(req.auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account email required" }, { status: 403 });
  }

  const { id } = await params as { id: string };
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing paper id" }, { status: 400 });
  }

  const asset = await getPaperAssetById(id.trim());
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (account.workspaceId && asset.workspace_id && asset.workspace_id !== account.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (asset.status === "ready") {
    return NextResponse.json({ error: "Paper is already ready" }, { status: 409 });
  }

  if (!asset.arxiv_id) {
    return NextResponse.json(
      { error: "Retry is only supported for arXiv papers. Re-upload the PDF to retry." },
      { status: 422 },
    );
  }

  await markPaperAssetProcessingStarted(asset.id);

  try {
    const result = await fetchArxivPaper(asset.arxiv_id);
    const checksumSha256 = computeBufferChecksum(result.pdfBuffer);
    const paperAbstract = result.text.slice(0, 600).trim();

    const ingested = await ingestPaper({
      text: result.text,
      title: result.title,
      sourceUrl: result.url,
      sourceType: "academic",
      pdfBuffer: result.pdfBuffer,
    });

    const updated = await attachIngestedDocumentToPaperAsset({
      paperAssetId: asset.id,
      ingestResult: ingested,
      title: result.title,
      abstract: paperAbstract,
      arxivId: asset.arxiv_id,
      checksumSha256,
    });

    return NextResponse.json({ status: updated.status, markerProcessed: updated.marker_processed });
  } catch (err) {
    await markPaperAssetProcessingFailed(asset.id, err).catch(() => {});
    const msg = err instanceof Error ? err.message : "Retry failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
