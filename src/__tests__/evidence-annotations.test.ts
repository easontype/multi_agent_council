import { buildEvidenceAnnotations, isInspectableSourceRef } from '../lib/evidence-annotations'
import type { SourceRef } from '../types/council'

function makeSourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    label: 'Attention Is All You Need',
    uri: 'https://arxiv.org/abs/1706.03762',
    snippet: 'The base Transformer model achieves 27.3 BLEU on the English-to-German translation task.',
    round: 1,
    agentId: 'methods',
    agentColor: '#43506b',
    agentAvatar: 'M',
    agentName: 'Methods Critic',
    ...overrides,
  }
}

describe('evidence-annotations', () => {
  it('filters out generic synthetic source refs', () => {
    expect(isInspectableSourceRef(makeSourceRef({ label: 'rag:ablation query' }))).toBe(false)
    expect(isInspectableSourceRef(makeSourceRef())).toBe(true)
  })

  it('creates sentence-level annotations when a sentence overlaps with retrieved evidence', () => {
    const text = [
      'The base Transformer reaches 27.3 BLEU on English-to-German, which supports the core empirical claim.',
      'The ablation coverage still feels incomplete.',
    ].join(' ')

    const annotations = buildEvidenceAnnotations(text, [makeSourceRef()])

    expect(annotations).toHaveLength(1)
    expect(annotations[0]?.text).toContain('27.3 BLEU')
    expect(annotations[0]?.sourceRef.label).toBe('Attention Is All You Need')
  })

  it('does not annotate unsupported prose', () => {
    const text = 'The writing quality is uneven and the framing is still too broad for a top-tier venue.'
    const annotations = buildEvidenceAnnotations(text, [makeSourceRef()])
    expect(annotations).toHaveLength(0)
  })
})
