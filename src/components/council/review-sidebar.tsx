'use client'

import { useState } from 'react'
import { ChatWithPaper } from './chat-with-paper'
import { DebateMap } from './debate-map'
import { SourcePanel } from './source-panel'
import type { DiscussionSession } from '@/types/council'

interface ReviewSidebarProps {
  session: DiscussionSession
  activeSourceLabel?: string | null
  tab?: 'citations' | 'flow' | 'chat'
  onTabChange?: (tab: 'citations' | 'flow' | 'chat') => void
}

export function ReviewSidebar({ session, activeSourceLabel, tab: tabProp, onTabChange }: ReviewSidebarProps) {
  const [localTab, setLocalTab] = useState<'citations' | 'flow' | 'chat'>('citations')
  const tab = tabProp ?? localTab
  const setTab = onTabChange ?? setLocalTab
  const hasRound2 = session.messages.some((message) => message.round === 2 && message.isComplete)
  const tabs = [
    { key: 'citations' as const, label: 'Citations' },
    { key: 'flow' as const, label: 'Flow', disabled: !hasRound2 },
    { key: 'chat' as const, label: 'Chat' },
  ]

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
          {tabs.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => !item.disabled && setTab(item.key)}
                disabled={item.disabled}
                style={{
                  border: 'none',
                  background: active ? '#111827' : 'transparent',
                  color: item.disabled ? '#c4c4cc' : active ? '#fff' : '#71717a',
                  padding: '6px 11px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.75 : 1,
                }}
                title={item.disabled ? 'Available after Round 2 completes' : undefined}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'citations' ? (
          <SourcePanel session={session} activeLabel={activeSourceLabel} />
        ) : tab === 'flow' ? (
          <DebateMap session={session} />
        ) : (
          <ChatWithPaper sessionId={session.id || null} />
        )}
      </div>
    </div>
  )
}
