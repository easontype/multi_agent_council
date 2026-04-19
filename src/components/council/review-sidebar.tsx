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
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        borderLeft: '1px solid #ececf1',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 18px',
          background: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid #ececf1',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          Workspace Panel
        </span>

        <div style={{ display: 'inline-flex', border: '1px solid #ebebed', borderRadius: 999, overflow: 'hidden', background: '#fff' }}>
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
                  background: active ? '#111827' : 'transparent',
                  color: active ? '#fff' : '#71717a',
                  padding: '6px 11px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
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
