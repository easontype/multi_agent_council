'use client'

import { Agent } from '@/types/council'

interface AgentAvatarProps {
  agent: Agent
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
}

export function AgentAvatar({ agent, size = 'md', showPulse = false }: AgentAvatarProps) {
  const sizes = {
    sm: { container: 28, font: 11 },
    md: { container: 36, font: 13 },
    lg: { container: 44, font: 16 },
  }

  const s = sizes[size]

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: s.container,
          height: s.container,
          borderRadius: '50%',
          background: agent.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: s.font,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {agent.avatar}
      </div>
      {showPulse && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #fff',
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
