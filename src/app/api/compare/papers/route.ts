import { NextRequest, NextResponse } from "next/server";
import { runLLM } from "@/lib/llm/claude";
import { DEFAULT_GEMMA_MODEL } from "@/lib/llm/gemma-models";
import { applyEntitlementResponse, checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";
import { toSafeError } from "@/lib/utils/text";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";

export interface PaperMeta {
  arxivId: string | null;
  title: string;
  abstract: string;
  kind: 'arxiv' | 'upload';
}

export interface PaperComparison {
  methodology: string[];
  data_experiments: string[];
  contributions: string[];
  limitations: string[];
  novelty: string[];
  verdict: string;
}

async function fetchArxivMeta(arxivId: string): Promise<PaperMeta | null> {
  try {
    const clean = arxivId.trim().replace(/^arxiv:/i, "");
    const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(clean)}&max_results=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Council-Academic/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const xml = await res.text();
    const titleMatch = xml.match(/<title>(?!ArXiv)([\s\S]*?)<\/title>/);
    const abstractMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/);
    const idMatch = xml.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);

    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const abstract = abstractMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const resolvedId = idMatch?.[1]?.trim() ?? clean;

    if (!title) return null;
    return { kind: 'arxiv' as const, arxivId: resolvedId, title, abstract: abstract.slice(0, 900) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const account = await resolveAuthAccountContext();
  const anonymousVisitor = account ? null : ensureAnonymousVisitorIdentity(req);

  const compareTier = account ? await getWorkspaceTierByEmail(account.email) : "free";
  if (compareTier !== "pro") {
    return NextResponse.json(
      { error: "Paper comparison is a Pro feature. Upgrade to unlock it." },
      { status: 403 },
    );
  }

  const quota = await checkEntitlement(req, "web_analyze", anonymousVisitor ?? undefined);
  if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds, quota.anonymousVisitorIdToSet);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  interface SlotInput {
    kind: 'arxiv' | 'upload';
    arxivId?: string;
    title?: string;
    abstract?: string;
  }

  const rawBody = body as Record<string, unknown>;
  let slots: SlotInput[];

  if (Array.isArray(rawBody.papers)) {
    slots = (rawBody.papers as unknown[]).filter((x): x is SlotInput => x !== null && typeof x === 'object');
  } else {
    // backwards compat: arxivIds array
    const ids = Array.isArray(rawBody.arxivIds)
      ? (rawBody.arxivIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    slots = ids.map(id => ({ kind: 'arxiv' as const, arxivId: id }));
  }

  if (slots.length < 2 || slots.length > 4) {
    return NextResponse.json({ error: "Provide 2–4 papers" }, { status: 400 });
  }

  const results = await Promise.all(
    slots.map(async (s): Promise<PaperMeta | null> => {
      if (s.kind === 'upload') {
        if (!s.title) return null;
        return { kind: 'upload', arxivId: null, title: s.title, abstract: (s.abstract ?? '').slice(0, 900) };
      }
      return s.arxivId ? fetchArxivMeta(s.arxivId) : null;
    })
  );
  const papers = results.filter((p): p is PaperMeta => p !== null);

  if (papers.length < 2) {
    return NextResponse.json({ error: "Could not retrieve at least 2 papers" }, { status: 422 });
  }

  const lang = req.cookies.get('ui-lang')?.value ?? 'en';
  const langNames: Record<string, string> = {
    'en': 'English',
    'zh-TW': 'Traditional Chinese (繁體中文)',
    'zh-CN': 'Simplified Chinese (简体中文)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
  };
  const outputLang = langNames[lang] ?? 'English';

  const n = papers.length;
  const sections = papers
    .map((p, i) => `PAPER ${i + 1}: "${p.title}"${p.arxivId ? ` (arXiv:${p.arxivId})` : ''}\n${p.abstract}`)
    .join("\n\n---\n\n");

  const prompt = `You are a rigorous academic analyst. Carefully read the following ${n} paper abstracts and produce a structured comparison in JSON (no markdown fences, no extra text).

IMPORTANT: Write ALL text values in the JSON in ${outputLang}.

Return exactly this JSON shape:
{
  "methodology": [<one concise sentence per paper describing the core method>],
  "data_experiments": [<one sentence per paper on datasets or benchmarks used, or "Not specified" if not mentioned>],
  "contributions": [<one sentence per paper on the main claimed contribution>],
  "limitations": [<one sentence per paper on stated or implied limitations>],
  "novelty": [<one sentence per paper: "High/Medium/Low — brief reason">],
  "verdict": "<2–3 sentences synthesising how the papers relate and which most advances the field>"
}

Each array must contain exactly ${n} strings in the same order as the papers below.

${sections}`;

  try {
    const raw = await runLLM(prompt, undefined, DEFAULT_GEMMA_MODEL);
    let comparison: PaperComparison;
    try {
      const clean = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
      comparison = JSON.parse(clean) as PaperComparison;
    } catch {
      return NextResponse.json({ error: "LLM returned unparseable JSON", raw }, { status: 500 });
    }

    return applyEntitlementResponse(NextResponse.json({ papers, comparison }), quota);
  } catch (err) {
    return applyEntitlementResponse(
      NextResponse.json({ error: toSafeError(err, 'paper compare') }, { status: 500 }),
      quota,
    );
  }
}
