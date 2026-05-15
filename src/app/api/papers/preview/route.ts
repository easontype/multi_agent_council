import { NextRequest, NextResponse } from "next/server";
import { toSafeError } from "@/lib/utils/text";

/**
 * GET /api/papers/preview?arxiv=XXXX
 *
 * Fetches arXiv metadata (title + abstract) without downloading the PDF or
 * triggering embedding. Used for instant paper preview in the /home input box.
 *
 * Output: { title, abstract, url, arxivId }
 */
export async function GET(req: NextRequest) {
  const arxivId = req.nextUrl.searchParams.get("arxiv")?.trim().replace(/^arxiv:/i, "");
  if (!arxivId) {
    return NextResponse.json({ error: "arxiv query param is required" }, { status: 400 });
  }

  try {
    const apiUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}&max_results=1`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Council-Academic/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `arXiv API error: ${res.status}` }, { status: 502 });
    }

    const xml = await res.text();

    const titleMatch = xml.match(/<title>(?!ArXiv)([\s\S]*?)<\/title>/);
    const abstractMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/);
    const idMatch = xml.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);

    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const abstract = abstractMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const resolvedId = idMatch?.[1]?.trim() ?? arxivId;

    if (!title) {
      return NextResponse.json({ error: "arXiv paper not found" }, { status: 404 });
    }

    return NextResponse.json({
      title,
      abstract: abstract.slice(0, 600),
      url: `https://arxiv.org/abs/${resolvedId}`,
      arxivId: resolvedId,
    });
  } catch (err) {
    return NextResponse.json({ error: toSafeError(err, 'paper preview') }, { status: 500 });
  }
}
