'use client'

interface PaperPreviewProps {
  title: string
  sourceLabel: string
  pdfUrl: string | null
  sourceHref?: string | null
  helperText?: string
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: '#a1a1aa',
        padding: '32px 24px',
        textAlign: 'center',
        background: '#fff',
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#71717a', marginBottom: 4 }}>Preview unavailable</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          Add an arXiv paper or upload a PDF to stage it here before the panel begins.
        </div>
      </div>
    </div>
  )
}

export function PaperPreview({ title, sourceLabel, pdfUrl, sourceHref, helperText }: PaperPreviewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fcfcfb' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 18px',
          borderBottom: '1px solid #ececf1',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 5 }}>
            Under Review
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#18181b',
              lineHeight: 1.45,
              fontFamily: "'Georgia', 'Times New Roman', serif",
              letterSpacing: '-0.015em',
              marginBottom: 3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sourceLabel}
          </div>
        </div>

        {sourceHref && (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 11px',
              borderRadius: 999,
              border: '1px solid #ececf1',
              color: '#52525b',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 500,
              flexShrink: 0,
              background: '#fff',
            }}
          >
            Open source <ExternalIcon />
          </a>
        )}
      </div>

      <div style={{ flex: 1, padding: 16, overflow: 'hidden', background: '#fcfcfb' }}>
        <div
          style={{
            height: '100%',
            border: '1px solid #ececf1',
            borderRadius: 14,
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #ececf1', background: '#fcfcfb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
              Paper Preview
            </div>
          </div>

          <div style={{ height: 'calc(100% - 56px)', background: '#f5f5f7' }}>
            {pdfUrl ? (
              <iframe
                title={`Preview of ${title}`}
                src={pdfUrl}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      {helperText && (
        <div style={{ padding: '11px 18px 14px', borderTop: '1px solid #ececf1', color: '#71717a', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
          {helperText}
        </div>
      )}
    </div>
  )
}
