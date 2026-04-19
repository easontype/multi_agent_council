import { db } from './db'
import { runLLM } from './claude'
import { getSession } from './council'
import type { CouncilEvidenceSource } from './council-types'
import { DEFAULT_GEMMA_MODEL } from './gemma-models'

interface SearchRow {
  chunk: string
  title: string
  source_url: string | null
  score: number
}

export interface CouncilPaperChatResult {
  answer: string
  answerMode: 'grounded_llm' | 'extractive_fallback'
  model: string | null
  citations: CouncilEvidenceSource[]
}

function extractLibraryTag(session: Awaited<ReturnType<typeof getSession>>) {
  const libraryId = session?.seats.find((seat) => seat.library_id)?.library_id
  return libraryId ? `council:lib:${libraryId}` : null
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function extractKeywordTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase()
  const terms = new Set<string>()

  if (normalized.length >= 2) terms.add(normalized)
  for (const token of normalized.match(/[a-z0-9][a-z0-9._:-]{1,}/g) ?? []) {
    if (token.length >= 2) terms.add(token)
  }
  for (const phrase of normalized.match(/[\u3400-\u9fff]{2,}/g) ?? []) {
    terms.add(phrase)
  }

  return [...terms].slice(0, 12)
}

async function keywordSearch(query: string, tag: string, limit: number): Promise<SearchRow[]> {
  const patterns = extractKeywordTerms(query).map((term) => `%${escapeLikePattern(term)}%`)
  const effectivePatterns = patterns.length ? patterns : [`%${escapeLikePattern(query.toLowerCase())}%`]

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
     WHERE d.tags ? $2
       AND (
         lower(c.content) LIKE ANY($1::text[])
         OR lower(d.title) LIKE ANY($1::text[])
         OR lower(COALESCE(d.source_url, '')) LIKE ANY($1::text[])
       )
     ORDER BY score DESC, d.created_at DESC NULLS LAST, c.chunk_index ASC
     LIMIT $3`,
    [effectivePatterns, tag, limit],
  )

  return rows.map((row) => ({
    chunk: String(row.chunk ?? ''),
    title: String(row.title ?? ''),
    source_url: row.source_url ? String(row.source_url) : null,
    score: Number(row.score ?? 0),
  }))
}

function buildContext(rows: SearchRow[]) {
  return rows
    .map((row, index) => `[${index + 1}] ${row.title}${row.source_url ? ` (${row.source_url})` : ''}\n${row.chunk.trim()}`)
    .join('\n\n')
    .slice(0, 12000)
}

function buildCitations(rows: SearchRow[]): CouncilEvidenceSource[] {
  return rows.slice(0, 6).map((row) => ({
    label: row.title,
    uri: row.source_url,
    snippet: row.chunk.trim().slice(0, 260),
  }))
}

function buildExtractiveAnswer(question: string, rows: SearchRow[]) {
  const snippets = rows.slice(0, 3).map((row, index) => {
    const excerpt = row.chunk.replace(/\s+/g, ' ').trim().slice(0, 280)
    return `[${index + 1}] ${excerpt}${row.chunk.length > 280 ? '...' : ''}`
  })

  return [
    `I could not run the answer model for "${question}", so here are the most relevant paper excerpts:`,
    '',
    ...snippets,
  ].join('\n')
}

export async function answerCouncilPaperQuestion(sessionId: string, question: string): Promise<CouncilPaperChatResult> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')

  const tag = extractLibraryTag(session)
  if (!tag) throw new Error('This session does not have an attached paper library')

  const rows = await keywordSearch(question, tag, 6)
  if (!rows.length) {
    return {
      answer: 'No relevant passages were found for this question in the current paper library.',
      answerMode: 'extractive_fallback',
      model: null,
      citations: [],
    }
  }

  const model = process.env.COUNCIL_CHAT_MODEL || process.env.RAG_CHAT_MODEL || DEFAULT_GEMMA_MODEL
  const systemPrompt = [
    'You answer questions about a single academic paper.',
    'Use only the supplied paper excerpts.',
    'Be concise, directly answer the question, and cite sources as [1], [2], etc.',
    'If the evidence is incomplete, say so clearly.',
  ].join('\n')

  const prompt = [
    `Question: ${question}`,
    '',
    'Paper excerpts:',
    buildContext(rows),
    '',
    'Answer in plain text.',
  ].join('\n')

  try {
    const answer = await runLLM(prompt, systemPrompt, model)
    return {
      answer: answer.trim() || buildExtractiveAnswer(question, rows),
      answerMode: answer.trim() ? 'grounded_llm' : 'extractive_fallback',
      model,
      citations: buildCitations(rows),
    }
  } catch {
    return {
      answer: buildExtractiveAnswer(question, rows),
      answerMode: 'extractive_fallback',
      model: null,
      citations: buildCitations(rows),
    }
  }
}
