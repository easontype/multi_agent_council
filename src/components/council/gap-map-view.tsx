'use client'

import { useEffect, useState } from 'react'
import type { DiscussionSession } from '@/types/council'

interface SectionCoverage {
  heading: string
  startChunk: number
  endChunk: number
  citedCount: number
}

interface DocumentCoverage {
  id: string
  title: string
  totalChunks: number
  citedChunkIndices: number[]
  sections: SectionCoverage[]
}

interface CoverageResponse {
  documents: DocumentCoverage[]
}

interface GapMapViewProps {
  session: DiscussionSession
  onLocateInDocument?: (docId: string, chunkIndex: number) => void
}

function BlindSpotBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa',
      borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', flexShrink: 0,
    }}>
      blind spot
    </span>
  )
}

function CoverageBar({ totalChunks, citedChunkIndices }: { totalChunks: number; citedChunkIndices: number[] }) {
  if (totalChunks === 0) return null
  const cited = new Set(citedChunkIndices)
  const BAR_CELLS = Math.min(totalChunks, 60)
  const ratio = totalChunks / BAR_CELLS

  return (
    <div style={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {Array.from({ length: BAR_CELLS }, (_, i) => {
        const chunkIdx = Math.round(i * ratio)
        const isCited = cited.has(chunkIdx)
        return (
          <div
            key={i}
            style={{
              width: 8, height: 12, borderRadius: 2,
              background: isCited ? '#c28f3d' : '#e7dfd1',
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}

function SectionRow({
  section,
  totalChunks,
  onLocate,
}: {
  section: SectionCoverage
  totalChunks: number
  onLocate?: (chunkIndex: number) => void
}) {
  const sectionSize = section.endChunk - section.startChunk + 1
  const pct = sectionSize > 0 ? Math.round((section.citedCount / sectionSize) * 100) : 0
  const isBlindSpot = section.citedCount === 0 && sectionSize > 0

  const barWidth = totalChunks > 0 ? Math.max(4, Math.round((sectionSize / totalChunks) * 100)) : 0

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f0e8' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#3f3f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {section.heading}
          </span>
          {isBlindSpot && <BlindSpotBadge />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 6, borderRadius: 3, background: '#e7dfd1', flex: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: isBlindSpot ? '#fed7aa' : '#c28f3d', borderRadius: 3, transition: 'width 300ms' }} />
          </div>
          <span style={{ fontSize: 10, color: '#a1a1aa', whiteSpace: 'nowrap', minWidth: 48 }}>
            {section.citedCount}/{sectionSize}
          </span>
        </div>
      </div>
      {onLocate && (
        <button
          type="button"
          onClick={() => onLocate(section.startChunk)}
          title="Open in reader"
          style={{
            padding: '3px 7px', borderRadius: 5, border: '1px solid #e7dfd1',
            background: '#fff', color: '#7a5a33', fontSize: 10, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          View
        </button>
      )}
    </div>
  )
}

export function GapMapView({ session, onLocateInDocument }: GapMapViewProps) {
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session.id || session.id === 'demo-session') return
    setLoading(true)
    setError(null)
    fetch(`/api/sessions/${session.id}/citation-coverage`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load coverage data')
        return res.json() as Promise<CoverageResponse>
      })
      .then((data) => setCoverage(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [session.id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 13 }}>
        Loading coverage data…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#b45309', fontSize: 13 }}>{error}</div>
    )
  }

  if (!coverage || coverage.documents.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 13, textAlign: 'center', padding: 32 }}>
        No document citation data yet. Run a debate with document-backed sources to see coverage.
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 18px 28px' }}>
      {coverage.documents.map((doc) => {
        const citedCount = doc.citedChunkIndices.length
        const coveragePct = doc.totalChunks > 0 ? Math.round((citedCount / doc.totalChunks) * 100) : 0
        const blindSpotSections = doc.sections.filter((s) => s.citedCount === 0 && (s.endChunk - s.startChunk + 1) > 0)

        return (
          <div key={doc.id} style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#18181b' }}>{doc.title}</span>
                <span style={{ fontSize: 11, color: '#a1a1aa' }}>{citedCount} / {doc.totalChunks} chunks cited ({coveragePct}%)</span>
                {blindSpotSections.length > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa',
                    borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
                  }}>
                    {blindSpotSections.length} blind spot{blindSpotSections.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <CoverageBar totalChunks={doc.totalChunks} citedChunkIndices={doc.citedChunkIndices} />
            </div>

            {doc.sections.length > 0 && (
              <div style={{ background: '#fffdf8', border: '1px solid #ece7dc', borderRadius: 12, padding: '4px 14px 2px' }}>
                {doc.sections.map((section) => (
                  <SectionRow
                    key={section.heading}
                    section={section}
                    totalChunks={doc.totalChunks}
                    onLocate={onLocateInDocument ? (chunkIdx) => onLocateInDocument(doc.id, chunkIdx) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
