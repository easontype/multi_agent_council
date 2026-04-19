'use client'

import { Agent } from '@/types/council'

interface AgentAvatarProps {
  agent: Agent
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
}

export function AgentAvatar({ agent, size = 'md', showPulse = false }: AgentAvatarProps) {
  const sizes = {
    sm: { container: 26, font: 10 },
    md: { container: 34, font: 13 },
    lg: { container: 44, font: 16 },
  }
  const s = sizes[size]

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: s.container, height: s.container, borderRadius: '50%',
        background: agent.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: s.font, fontWeight: 700, color: '#fff',
        transition: 'box-shadow 300ms',
        boxShadow: showPulse
          ? `0 0 0 2px #fff, 0 0 0 3px ${agent.color}33, 0 8px 18px ${agent.color}2c`
          : `0 1px 4px rgba(0, 0, 0, 0.04)`,
      }}>
        {agent.avatar}
      </div>
      {showPulse && (
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 8, height: 8, borderRadius: '50%',
          background: '#16a34a', border: '2px solid #fff',
          animation: 'av-pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <style>{`
        @keyframes av-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.2); } }
      `}</style>
    </div>
  )
}
