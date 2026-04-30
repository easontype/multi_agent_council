import type { SourceRef } from '@/types/council'

export interface EvidenceAnnotation {
  id: string
  start: number
  end: number
  text: string
  sourceRef: SourceRef
  score: number
}

const GENERIC_SOURCE_PREFIXES = ['rag:', 'semantic:', 'documents tag:', 'document:']
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'all', 'any', 'can', 'did', 'does', 'done', 'for', 'get',
  'had', 'has', 'her', 'hers', 'him', 'his', 'how', 'its', 'our', 'out', 'she', 'the',
  'them', 'then', 'they', 'too', 'use', 'very', 'was', 'you',
  'about', 'after', 'against', 'also', 'among', 'been', 'being', 'between', 'both',
  'claim', 'claims', 'could', 'data', 'details', 'evidence', 'from', 'have', 'into',
  'just', 'main', 'might', 'more', 'most', 'paper', 'papers', 'result', 'results',
  'section', 'should', 'some', 'such', 'than', 'that', 'their', 'there', 'these',
  'this', 'those', 'under', 'using', 'used', 'were', 'what', 'when', 'which', 'with',
  'would', 'your', 'is', 'it', 'on', 'of', 'to', 'in', 'or', 'as', 'be', 'by', 'if',
])

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/^[^a-z0-9\u3400-\u9fff]+|[^a-z0-9\u3400-\u9fff]+$/g, '')
}

function isNumericToken(token: string): boolean {
  return /\d/.test(token)
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .match(/[a-z0-9][a-z0-9._:%/-]*|[\u3400-\u9fff]{2,}/gi)
    ?.map(normalizeToken)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    ?? []
}

function buildWeightedTokenMap(sourceRef: SourceRef) {
  const snippetWeights = new Map<string, number>()
  const labelWeights = new Map<string, number>()
  const uriWeights = new Map<string, number>()

  const addTokens = (target: Map<string, number>, text: string, baseWeight: number, minLength = 2) => {
    for (const token of tokenize(text)) {
      if (token.length < minLength && !isNumericToken(token)) continue
      const nextWeight = baseWeight + (isNumericToken(token) ? 2 : 0)
      target.set(token, Math.max(target.get(token) ?? 0, nextWeight))
    }
  }

  addTokens(labelWeights, sourceRef.label, 2, 4)
  addTokens(snippetWeights, sourceRef.snippet ?? '', 3, 3)
  if (sourceRef.uri) addTokens(uriWeights, sourceRef.uri, 2, 3)

  return { snippetWeights, labelWeights, uriWeights }
}

function getExactFragmentBonus(sentence: string, sourceRef: SourceRef): number {
  const haystack = normalizeWhitespace(sentence).toLowerCase()
  const sourceText = normalizeWhitespace(`${sourceRef.label} ${sourceRef.snippet ?? ''}`).toLowerCase()
  if (!haystack || !sourceText) return 0

  const quotedFragments = sourceText
    .split(/[.;!?。！？]\s+/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 24)

  for (const fragment of quotedFragments) {
    if (haystack.includes(fragment) || fragment.includes(haystack)) {
      return 6
    }
  }

  return 0
}

function scoreSentence(sentence: string, sourceRef: SourceRef): number {
  if (!sourceRef.snippet) return 0

  const sentenceTokens = new Set(tokenize(sentence))
  if (!sentenceTokens.size) return 0

  const { snippetWeights, labelWeights, uriWeights } = buildWeightedTokenMap(sourceRef)
  let score = getExactFragmentBonus(sentence, sourceRef)
  let snippetScore = score > 0 ? 3 : 0

  for (const token of sentenceTokens) {
    const snippetWeight = snippetWeights.get(token)
    if (snippetWeight) {
      score += snippetWeight
      snippetScore += snippetWeight
      continue
    }

    const labelWeight = labelWeights.get(token)
    if (labelWeight) {
      score += labelWeight
      continue
    }

    const uriWeight = uriWeights.get(token)
    if (uriWeight) score += uriWeight
  }

  return snippetScore >= 3 ? score : 0
}

function splitSentenceRanges(text: string): Array<{ start: number; end: number; text: string }> {
  const ranges: Array<{ start: number; end: number; text: string }> = []
  let start = 0

  const pushRange = (rangeStart: number, rangeEnd: number) => {
    const raw = text.slice(rangeStart, rangeEnd)
    const trimmed = raw.trim()
    if (!trimmed) return
    const leadingWhitespace = raw.indexOf(trimmed)
    ranges.push({
      start: rangeStart + Math.max(leadingWhitespace, 0),
      end: rangeStart + Math.max(leadingWhitespace, 0) + trimmed.length,
      text: trimmed,
    })
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const prev = text[index - 1] ?? ''
    const next = text[index + 1] ?? ''
    const isBoundaryChar = /[.!?。！？]/.test(char)
    const isDecimalPoint = char === '.' && /\d/.test(prev) && /\d/.test(next)

    if (char === '\n') {
      pushRange(start, index)
      start = index + 1
      continue
    }

    if (!isBoundaryChar || isDecimalPoint) continue

    pushRange(start, index + 1)
    start = index + 1
  }

  pushRange(start, text.length)
  return ranges
}

function isGenericSourceRef(sourceRef: SourceRef): boolean {
  const label = sourceRef.label.trim().toLowerCase()
  return GENERIC_SOURCE_PREFIXES.some((prefix) => label.startsWith(prefix))
}

function isCitationSourceRef(sourceRef: SourceRef): boolean {
  return !isGenericSourceRef(sourceRef) && Boolean(sourceRef.snippet?.trim() || sourceRef.uri)
}

export function isInspectableSourceRef(sourceRef: SourceRef): boolean {
  if (!sourceRef.snippet || sourceRef.snippet.trim().length < 24) return false
  return !isGenericSourceRef(sourceRef)
}

export function isVisibleSourceRef(sourceRef: SourceRef): boolean {
  if (isGenericSourceRef(sourceRef)) return false
  return Boolean(
    sourceRef.label.trim() &&
    (sourceRef.uri || sourceRef.snippet?.trim() || sourceRef.marker)
  )
}

export function getSourceRefDisplayUrl(sourceRef: SourceRef): string | null {
  if (!sourceRef.uri) return null
  try {
    const url = new URL(sourceRef.uri)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return sourceRef.uri
  }
}

export function buildEvidenceAnnotations(text: string, sourceRefs: SourceRef[]): EvidenceAnnotation[] {
  const citationRefs = sourceRefs.filter(isCitationSourceRef)
  const inspectableRefs = sourceRefs.filter(isInspectableSourceRef)
  if (!text.trim() || (!citationRefs.length && !inspectableRefs.length)) return []

  const annotations: EvidenceAnnotation[] = []
  const findCitationRef = (marker: string, number: number) =>
    citationRefs.find((ref) => ref.marker === marker) ?? citationRefs[number - 1] ?? null

  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const raw = match[0]
    const number = Number(match[1])
    const start = match.index ?? -1
    if (start < 0 || !Number.isFinite(number) || number < 1) continue

    const sourceRef = findCitationRef(raw, number)
    if (!sourceRef) continue

    annotations.push({
      id: `${start}-${start + raw.length}-${raw}`,
      start,
      end: start + raw.length,
      text: raw,
      sourceRef,
      score: 100,
    })
  }

  const sentenceRanges = splitSentenceRanges(text)

  for (const range of sentenceRanges) {
    if (annotations.some((annotation) => annotation.start < range.end && range.start < annotation.end)) {
      continue
    }
    const cleanSentence = normalizeWhitespace(range.text)
    if (cleanSentence.length < 40) continue

    let bestRef: SourceRef | null = null
    let bestScore = 0

    for (const sourceRef of inspectableRefs) {
      const score = scoreSentence(cleanSentence, sourceRef)
      if (score > bestScore) {
        bestScore = score
        bestRef = sourceRef
      }
    }

    if (!bestRef || bestScore < 6) continue

    annotations.push({
      id: `${range.start}-${range.end}-${bestRef.label}`,
      start: range.start,
      end: range.end,
      text: range.text,
      sourceRef: bestRef,
      score: bestScore,
    })
  }

  return annotations.sort((a, b) => a.start - b.start)
}
