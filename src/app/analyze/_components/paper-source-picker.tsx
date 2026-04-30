'use client'

interface PaperSourcePickerProps {
  sourceDraft: string
  onSourceDraftChange: (value: string) => void
  onSourceSubmit: (event: React.FormEvent) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function PaperSourcePicker({
  sourceDraft,
  onSourceDraftChange,
  onSourceSubmit,
  onFileChange,
}: PaperSourcePickerProps) {
  return (
    <div style={{
      margin: '16px 16px 0',
      border: '1px solid #ececf1',
      borderRadius: 14,
      background: '#fff',
      padding: '14px 15px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 7 }}>
        Source
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b', marginBottom: 5 }}>
        Start from arXiv or PDF
      </div>
      <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.55, marginBottom: 11 }}>
        Paste an arXiv ID or upload a PDF, then configure the review team on the right.
      </div>

      <form onSubmit={onSourceSubmit} style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
        <input
          type="text"
          value={sourceDraft}
          onChange={(event) => onSourceDraftChange(event.target.value)}
          placeholder="arXiv ID e.g. 1706.03762"
          style={{
            flex: 1,
            border: '1px solid #d4d4d8',
            borderRadius: 10,
            padding: '9px 11px',
            fontSize: 13,
            color: '#18181b',
            outline: 'none',
            background: '#fcfcfb',
          }}
        />
        <button
          type="submit"
          disabled={!sourceDraft.trim()}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '9px 13px',
            background: sourceDraft.trim() ? '#111827' : '#d4d4d8',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: sourceDraft.trim() ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }}
        >
          Use arXiv
        </button>
      </form>

      <label style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed #c7c7cf',
        borderRadius: 10,
        background: '#fafafa',
        color: '#3f3f46',
        padding: '9px 12px',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
      }}>
        Upload PDF
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  )
}
