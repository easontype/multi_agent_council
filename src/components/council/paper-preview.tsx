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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      color: '#bbb',
      padding: '32px 24px',
      textAlign: 'center',
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#999', marginBottom: 4 }}>Preview unavailable</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Add an arXiv paper or upload a PDF to stage it here before the panel begins.
        </div>
      </div>
    </div>
  )
}

export function PaperPreview({ title, sourceLabel, pdfUrl, sourceHref, helperText }: PaperPreviewProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 18px',
        borderBottom: '1px solid #f0f0f2',
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#bbb',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}>
            Paper Preview
          </div>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#1a1a1a',
            lineHeight: 1.45,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            letterSpacing: '-0.015em',
            marginBottom: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 12,
            color: '#999',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
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
              borderRadius: 8,
              border: '1px solid #ebebed',
              color: '#666',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 500,
              flexShrink: 0,
              transition: 'color 150ms, border-color 150ms, background 150ms',
            }}
          >
            Open source <ExternalIcon />
          </a>
        )}
      </div>

      <div style={{
        flex: 1,
        background: '#f5f5f7',
        padding: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          border: '1px solid #e8e8eb',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        }}>
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

      {helperText && (
        <div style={{
          padding: '11px 18px 14px',
          borderTop: '1px solid #f0f0f2',
          color: '#888',
          fontSize: 12,
          lineHeight: 1.6,
          flexShrink: 0,
        }}>
          {helperText}
        </div>
      )}
    </div>
  )
}
