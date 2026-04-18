'use client'

import { useState } from 'react'
import { ChatWithPaper } from './chat-with-paper'
import { SourcePanel } from './source-panel'
import type { DiscussionSession } from '@/types/council'

interface ReviewSidebarProps {
  session: DiscussionSession
  activeSourceLabel?: string | null
  tab?: 'sources' | 'chat'
  onTabChange?: (tab: 'sources' | 'chat') => void
}

export function ReviewSidebar({ session, activeSourceLabel, tab: tabProp, onTabChange }: ReviewSidebarProps) {
  const [localTab, setLocalTab] = useState<'sources' | 'chat'>('sources')
  const tab = tabProp ?? localTab
  const setTab = onTabChange ?? setLocalTab

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '14px 18px 0',
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f2',
      }}>
        {([
          { key: 'sources' as const, label: 'Sources' },
          { key: 'chat' as const, label: 'Chat' },
        ]).map((item) => {
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                border: 'none',
                borderBottom: `2px solid ${active ? '#111827' : 'transparent'}`,
                background: 'transparent',
                color: active ? '#111827' : '#9ca3af',
                padding: '0 2px 10px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'sources' ? (
          <SourcePanel session={session} activeLabel={activeSourceLabel} />
        ) : (
          <ChatWithPaper sessionId={session.id || null} />
        )}
      </div>
    </div>
  )
}
