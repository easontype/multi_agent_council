'use client'

interface SessionRestoreBannerProps {
  isVisible: boolean
  isResuming: boolean
  canResume: boolean
  restoredFrom: 'url' | 'local' | null
  onResume: () => void
}

export function SessionRestoreBanner({
  isVisible,
  isResuming,
  canResume,
  restoredFrom,
  onResume,
}: SessionRestoreBannerProps) {
  if (!isVisible) return null

  const sourceLabel = restoredFrom === 'local'
    ? 'Restored from your last opened review.'
    : 'Restored from the saved review link.'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 18px',
      borderBottom: '1px solid #ececf1',
      background: '#fafaf9',
      color: '#44403c',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a16207', marginBottom: 3 }}>
          Saved Session
        </div>
        <div style={{ fontSize: 13, color: '#57534e' }}>
          {sourceLabel}
          {canResume ? ' This session is still resumable.' : ' Showing the latest saved state from SQL.'}
        </div>
      </div>

      {canResume && (
        <button
          type="button"
          onClick={onResume}
          disabled={isResuming}
          style={{
            border: '1px solid #d6d3d1',
            borderRadius: 999,
            background: isResuming ? '#e7e5e4' : '#fff',
            color: '#292524',
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: isResuming ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isResuming ? 'Resuming...' : 'Resume Live Stream'}
        </button>
      )}
    </div>
  )
}
