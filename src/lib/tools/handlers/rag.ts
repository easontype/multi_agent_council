import { GoogleGenerativeAI } from "@google/generative-ai";
import { runLLM } from "../../claude";
import { runGemini } from "../../gemini";
import { db } from "../../db";
import { DEFAULT_GEMMA_RAG_MODEL } from "../../gemma-models";

type Handler = (agentId: string, args: Record<string, unknown>, depth: number) => Promise<string>;

interface SearchRow {
  chunk: string;
  title: string;
  source_url: string | null;
  score: number;
}

interface RetrievalResult {
  rows: SearchRow[];
  retrievalMode: "semantic" | "keyword_fallback";
  warnings: string[];
}

export interface EmbedDocumentResult {
  chunkCount: number;
  embeddedChunkCount: number;
  fallbackChunkCount: number;
}

const DEFAULT_GEMINI_RAG_MODEL = DEFAULT_GEMMA_RAG_MODEL;
const DEFAULT_CONTEXT_LIMIT = 9_000;
const HAS_CJK_RE = /[\u3400-\u9fff]/;

function getEmbeddingClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

async function embedText(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  const model = client.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType: "RETRIEVAL_DOCUMENT" as never,
    outputDimensionality: 768,
  } as never);
  return result.embedding.values;
}

function chunkText(text: string, maxLen = 600, overlap = 80): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = end - overlap;
  }
  const filtered = chunks.filter((chunk) => chunk.length > 30);
  if (filtered.length) return filtered;

  const trimmed = text.trim();
  return trimmed ? [trimmed.slice(0, maxLen)] : [];
}

function clampLimit(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function sanitizeTag(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function extractKeywordTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  const terms = new Set<string>();

  if (normalized.length >= 2 && normalized.length <= 80) {
    terms.add(normalized);
  }

  for (const token of normalized.match(/[a-z0-9][a-z0-9._:-]{1,}/g) ?? []) {
    if (token.length >= 2) terms.add(token);
  }

  for (const phrase of normalized.match(/[\u3400-\u9fff]{2,}/g) ?? []) {
    terms.add(phrase);
    if (phrase.length > 4) {
      for (let index = 0; index <= phrase.length - 4; index += 2) {
        terms.add(phrase.slice(index, index + 4));
        if (terms.size >= 14) break;
      }
    }
    if (terms.size >= 14) break;
  }

  return [...terms].slice(0, 14);
}

async function semanticChunkSearch(query: string, limit: number, tag?: string | null): Promise<SearchRow[]> {
  const vector = await embedText(query);
  const vectorLiteral = `[${vector.join(",")}]`;

  const params: unknown[] = [vectorLiteral, limit];
  let tagJoin = "";
  if (tag) {
    params.push(tag);
    tagJoin = `AND d.tags ? $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT c.content AS chunk,
            d.title,
            d.source_url,
            1 - (c.embedding <=> $1::vector) AS score
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.embedding IS NOT NULL ${tagJoin}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    params,
  );

  return rows.map((row) => ({
    chunk: String(row.chunk ?? ""),
    title: String(row.title ?? ""),
    source_url: row.source_url ? String(row.source_url) : null,
    score: Number(row.score ?? 0),
  }));
}

async function keywordChunkSearch(query: string, limit: number, tag?: string | null): Promise<SearchRow[]> {
  const rawTerms = extractKeywordTerms(query);
  const patterns = (rawTerms.length ? rawTerms : [query.trim().toLowerCase()])
    .filter(Boolean)
    .map((term) => `%${escapeLikePattern(term)}%`);

  const params: unknown[] = [patterns, limit];
  let tagJoin = "";
  if (tag) {
    params.push(tag);
    tagJoin = `AND d.tags ? $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT c.content AS chunk,
            d.title,
            d.source_url,
            (
              CASE WHEN lower(d.title) LIKE ANY($1::text[]) THEN 4 ELSE 0 END +
              CASE WHEN lower(COALESCE(d.source_url, '')) LIKE ANY($1::text[]) THEN 1 ELSE 0 END +
              (
                SELECT COALESCE(SUM(CASE WHEN lower(c.content) LIKE pattern THEN 1 ELSE 0 END), 0)
                FROM unnest($1::text[]) AS pattern
              )
            )::float AS score
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.content IS NOT NULL
       ${tagJoin}
       AND (
         lower(c.content) LIKE ANY($1::text[])
         OR lower(d.title) LIKE ANY($1::text[])
         OR lower(COALESCE(d.source_url, '')) LIKE ANY($1::text[])
       )
     ORDER BY score DESC, d.created_at DESC NULLS LAST, c.chunk_index ASC
     LIMIT $2`,
    params,
  );

  const normalizer = Math.max(rawTerms.length, 4);
  return rows.map((row) => {
    const rawScore = Number(row.score ?? 0);
    const normalizedScore = Math.min(0.98, Math.max(0.18, rawScore / normalizer));
    return {
      chunk: String(row.chunk ?? ""),
      title: String(row.title ?? ""),
      source_url: row.source_url ? String(row.source_url) : null,
      score: normalizedScore,
    };
  });
}

async function retrieveRelevantChunks(query: string, limit: number, tag?: string | null): Promise<RetrievalResult> {
  try {
    const semanticRows = await semanticChunkSearch(query, limit, tag);
    if (semanticRows.length) {
      return {
        rows: semanticRows,
        retrievalMode: "semantic",
        warnings: [],
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const keywordRows = await keywordChunkSearch(query, limit, tag);
    return {
      rows: keywordRows,
      retrievalMode: "keyword_fallback",
      warnings: [`semantic retrieval unavailable: ${message}`],
    };
  }

  const keywordRows = await keywordChunkSearch(query, limit, tag);
  return {
    rows: keywordRows,
    retrievalMode: "keyword_fallback",
    warnings: keywordRows.length ? ["semantic retrieval returned no rows; used keyword fallback"] : [],
  };
}

function buildChunkContext(rows: SearchRow[]): string {
  let total = 0;
  const sections: string[] = [];

  for (const [index, row] of rows.entries()) {
    const header = `[${index + 1}] ${row.title}${row.source_url ? ` (${row.source_url})` : ""}`;
    const body = row.chunk.trim();
    if (!body) continue;

    const nextSection = `${header}\n${body}`;
    if (total + nextSection.length > DEFAULT_CONTEXT_LIMIT && sections.length > 0) break;

    sections.push(nextSection);
    total += nextSection.length;
  }

  return sections.join("\n\n");
}

function buildSourceDigest(rows: SearchRow[]): string {
  return rows
    .map((row, index) => {
      const source = row.source_url ? ` | ${row.source_url}` : "";
      return `[${index + 1}] ${row.title}${source}`;
    })
    .join("\n");
}

function compactSnippet(text: string, limit = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 3))}...`;
}

function buildCompactEvidence(rows: SearchRow[], limit = 4): string {
  return rows
    .slice(0, limit)
    .map((row, index) => {
      const source = row.source_url ? ` | ${row.source_url}` : "";
      return `- [${index + 1}] ${row.title}${source}\n  ${compactSnippet(row.chunk, 180)}`;
    })
    .join("\n");
}

function buildExtractiveFallback(question: string, rows: SearchRow[], retrievalMode: RetrievalResult["retrievalMode"]): string {
  const snippets = rows.slice(0, 3).map((row, index) => {
    const cleaned = row.chunk.replace(/\s+/g, " ").trim();
    const excerpt = cleaned.length > 360 ? `${cleaned.slice(0, 357)}...` : cleaned;
    return `[${index + 1}] ${row.title}\n${excerpt}`;
  });

  return [
    `No answer model was available, so this is an extractive digest for: ${question}`,
    `retrieval_mode=${retrievalMode}`,
    "",
    ...snippets,
  ].join("\n");
}

function resolveRagModelCandidates(): string[] {
  const configured = [
    process.env.COUNCIL_RAG_LOCAL_MODEL,
    process.env.RAG_LOCAL_MODEL,
    process.env.RAG_MODEL,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const allowGeminiFallback = process.env.RAG_ALLOW_GEMINI_FALLBACK !== "0";
  if (allowGeminiFallback && process.env.GEMINI_API_KEY) {
    configured.push(DEFAULT_GEMINI_RAG_MODEL);
  }

  return [...new Set(configured)];
}

async function synthesizeRagAnswer(
  question: string,
  rows: SearchRow[],
  retrievalMode: RetrievalResult["retrievalMode"],
): Promise<{ answer: string; answerMode: "model" | "extractive_fallback"; model: string | null; warnings: string[] }> {
  const context = buildChunkContext(rows);
  const sourceDigest = buildSourceDigest(rows);
  const systemPrompt = [
    "Answer only from the provided knowledge base context.",
    "If the context is incomplete, say so clearly.",
    "Use Traditional Chinese unless the user asked in another language.",
    "Cite evidence with bracketed source numbers like [1] and [2].",
    "",
    "Sources:",
    sourceDigest,
    "",
    "Context:",
    context,
  ].join("\n");

  const warnings: string[] = [];
  for (const model of resolveRagModelCandidates()) {
    try {
      const answer = model.startsWith("gemini")
        ? await runGemini(question, systemPrompt, model)
        : await runLLM(question, systemPrompt, model);
      if (answer.trim()) {
        return {
          answer: answer.trim(),
          answerMode: "model",
          model,
          warnings,
        };
      }
      warnings.push(`empty answer from ${model}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${model} unavailable: ${message}`);
    }
  }

  return {
    answer: buildExtractiveFallback(question, rows, retrievalMode),
    answerMode: "extractive_fallback",
    model: null,
    warnings,
  };
}

function renderSearchRows(rows: SearchRow[], heading: string, retrievalMode: RetrievalResult["retrievalMode"], warnings: string[]): string {
  const visibleRows = rows.slice(0, 6);
  const body = visibleRows
    .map((row, index) => {
      const source = row.source_url ? ` | ${row.source_url}` : "";
      return `- [${index + 1}] ${row.title} (match ${(row.score * 100).toFixed(1)}%)${source}\n  ${compactSnippet(row.chunk, 220)}`;
    })
    .join("\n");

  const footer = [
    `retrieval_mode: ${retrievalMode}`,
    rows.length > visibleRows.length ? `omitted_results: ${rows.length - visibleRows.length}` : null,
    warnings.length ? `warnings: ${warnings.join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${heading}\n\n${body}\n\n${footer}`;
}

export async function embedDocumentById(documentId: string): Promise<EmbedDocumentResult> {
  const trimmedId = documentId.trim();
  if (!trimmedId) {
    throw new Error("documentId is required");
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, content
       FROM documents
       WHERE id = $1
       FOR UPDATE`,
      [trimmedId],
    );

    if (!rows.length) {
      throw new Error(`Document ${trimmedId} not found`);
    }

    const doc = rows[0] as { id: string; content: string | null };
    const chunks = chunkText(doc.content ?? "");

    await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [trimmedId]);

    let embeddedChunkCount = 0;
    let fallbackChunkCount = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      try {
        const vector = await embedText(chunk);
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4::vector)`,
          [trimmedId, index, chunk, `[${vector.join(",")}]`],
        );
        embeddedChunkCount += 1;
      } catch {
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, NULL)`,
          [trimmedId, index, chunk],
        );
        fallbackChunkCount += 1;
      }
    }

    await client.query(`UPDATE documents SET done = true WHERE id = $1`, [trimmedId]);
    await client.query("COMMIT");

    return {
      chunkCount: chunks.length,
      embeddedChunkCount,
      fallbackChunkCount,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const handlers: Record<string, Handler> = {
  async embed_documents(_agentId, args) {
    const documentId = typeof args.documentId === "string" ? args.documentId.trim() : "";

    if (documentId) {
      const result = await embedDocumentById(documentId);
      return [
        "embed_documents complete",
        `- document_id: ${documentId}`,
        `- chunks: ${result.chunkCount}`,
        `- embedded_chunks: ${result.embeddedChunkCount}`,
        `- fallback_chunks: ${result.fallbackChunkCount}`,
      ].join("\n");
    }

    const limit = clampLimit(args.limit, 10, 50);

    const { rows: docs } = await db.query(
      `SELECT d.id, d.title, d.content
       FROM documents d
       WHERE NOT EXISTS (
         SELECT 1 FROM document_chunks c WHERE c.document_id = d.id
       )
       ORDER BY d.created_at DESC
       LIMIT $1`,
      [limit],
    );

    if (!docs.length) {
      return "No documents are waiting for embeddings.";
    }

    let embedded = 0;
    let failed = 0;

    for (const doc of docs as Array<{ id: string; content: string }>) {
      try {
        await embedDocumentById(doc.id);
        embedded += 1;
      } catch {
        failed += 1;
      }
    }

    return [
      "embed_documents complete",
      `- embedded: ${embedded}/${docs.length}`,
      `- failed: ${failed}`,
    ].join("\n");
  },

  async semantic_search(_agentId, args) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const limit = clampLimit(args.limit, 5, 20);
    const tag = sanitizeTag(args.tag);

    if (!query) {
      return "query is required";
    }

    const retrieval = await retrieveRelevantChunks(query, limit, tag);
    if (!retrieval.rows.length) {
      return "No relevant knowledge chunks were found. Run embed_documents first or check whether the topic exists in the document store.";
    }

    return renderSearchRows(retrieval.rows, "## Semantic Search Results", retrieval.retrievalMode, retrieval.warnings);
  },

  async rag_query(_agentId, args) {
    const question = typeof args.question === "string" ? args.question.trim() : "";
    const limit = clampLimit(args.limit, 5, 8);
    const tag = sanitizeTag(args.tag);

    if (!question) {
      return "question is required";
    }

    const retrieval = await retrieveRelevantChunks(question, limit, tag);
    if (!retrieval.rows.length) {
      return "No relevant knowledge chunks were found. The council can continue, but this RAG query has no supporting material yet.";
    }

    const answer = await synthesizeRagAnswer(question, retrieval.rows, retrieval.retrievalMode);
    const notes = [...retrieval.warnings, ...answer.warnings];

    return [
      "## RAG Answer",
      `question: ${question}`,
      `retrieval_mode: ${retrieval.retrievalMode}`,
      `answer_mode: ${answer.answerMode}${answer.model ? ` (${answer.model})` : ""}`,
      `source_count: ${retrieval.rows.length}`,
      notes.length ? `warnings: ${notes.join(" | ")}` : null,
      "",
      "Answer:",
      compactSnippet(answer.answer, 1600),
      "",
      "Evidence:",
      buildCompactEvidence(retrieval.rows),
    ]
      .filter((line) => line !== null)
      .join("\n");
  },

  async generate_article(_agentId, args) {
    const topic = typeof args.topic === "string" ? args.topic.trim() : "";
    const tag = sanitizeTag(args.tag);
    const color = typeof args.color === "string" && args.color.trim() ? args.color.trim() : "#8B5CF6";
    const chunkLimit = clampLimit(args.chunk_limit, 8, 15);

    if (!topic) {
      return "topic is required";
    }

    const retrieval = await retrieveRelevantChunks(topic, chunkLimit, tag);
    if (!retrieval.rows.length) {
      return "No relevant knowledge chunks were found. Run embed_documents first or pick a topic that exists in the document store.";
    }

    const sourceDocs = [...new Set(retrieval.rows.map((row) => row.title))];
    const context = retrieval.rows
      .map((row, index) => `[${index + 1}] ${row.title} (match ${(row.score * 100).toFixed(0)}%)\n${row.chunk}`)
      .join("\n\n");

    const systemPrompt = [
      "Write a Traditional Chinese HTML article from the provided source context.",
      "Return plain text with these exact sections:",
      "---TITLE---",
      "---EXCERPT---",
      "---TAG---",
      "---READTIME---",
      "---CONTENT---",
      "Do not invent claims beyond the provided context.",
      "",
      "Context:",
      context,
    ].join("\n");

    const raw = await runGemini(topic, systemPrompt, DEFAULT_GEMINI_RAG_MODEL);

    const extract = (key: string) => {
      const match = raw.match(new RegExp(`---${key}---\\s*([\\s\\S]*?)(?=---[A-Z]+---|$)`));
      return match ? match[1].trim() : "";
    };

    const title = extract("TITLE") || `${topic} 深度解析`;
    const excerpt = extract("EXCERPT") || `從知識庫整理 ${topic} 的重點摘要。`;
    const articleTag = extract("TAG") || (HAS_CJK_RE.test(topic) ? "知識整理" : "AI");
    const readTime = extract("READTIME") || "5 min";
    const content = extract("CONTENT") || raw;

    if (!content.trim()) {
      return "Article generation failed because the model returned no content.";
    }

    const slugBase = topic
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const slug = `${slugBase}-${Date.now()}`;

    await db.query(
      `INSERT INTO generated_articles (slug, title, excerpt, tag, color, content, read_time, source_docs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE
       SET title = $2,
           excerpt = $3,
           tag = $4,
           color = $5,
           content = $6,
           read_time = $7,
           source_docs = $8,
           updated_at = NOW()`,
      [slug, title, excerpt, articleTag, color, content, readTime, sourceDocs],
    );

    const plainLength = content.replace(/<[^>]+>/g, "").length;
    return [
      "Article generated",
      `- title: ${title}`,
      `- slug: ${slug}`,
      `- length: ${plainLength}`,
      `- sources: ${sourceDocs.length}`,
      `- retrieval_mode: ${retrieval.retrievalMode}`,
      `- url: /blog/${slug}`,
    ].join("\n");
  },
};
