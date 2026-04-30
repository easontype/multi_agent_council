'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({
  content,
  color = '#3f3f46',
  fontSize = 14,
}: {
  content: string
  color?: string
  fontSize?: number
}) {
  return (
    <div
      style={{
        color,
        fontSize,
        lineHeight: 1.75,
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: '8px 0 10px', paddingLeft: 20 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '8px 0 10px', paddingLeft: 20 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
          strong: ({ children }) => (
            <strong style={{ color: '#18181b', fontWeight: 700, letterSpacing: '-0.01em' }}>{children}</strong>
          ),
          h1: ({ children }) => <h1 style={{ margin: '0 0 10px', fontSize: 18, color: '#18181b' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ margin: '14px 0 10px', fontSize: 16, color: '#18181b' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ margin: '12px 0 8px', fontSize: 14, color: '#18181b' }}>{children}</h3>,
          code: ({ children }) => (
            <code
              style={{
                background: '#f5f5f7',
                border: '1px solid #ececf1',
                borderRadius: 6,
                padding: '1px 5px',
                fontSize: '0.92em',
              }}
            >
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: '#355d7a', textDecoration: 'underline' }}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
