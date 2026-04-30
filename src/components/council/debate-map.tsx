'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { DiscussionSession, Agent, AgentMessage, TextBlock } from '@/types/council'
import { MarkdownContent } from './markdown-content'

// ── Text parsing ─────────────────────────────────────────────────────────────

function getTextContent(msg: AgentMessage): string {
  return msg.blocks
    .filter((b) => b.type === 'text')
    .map((b) => (b as TextBlock).content)
    .join('')
}

function extractSection(text: string, name: string): string {
  const re = new RegExp(`\\*\\*${name}\\*\\*\\s*[-–—]?\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|$)`, 'i')
  const match = text.match(re)
  return match ? match[1].trim() : ''
}

function parseChallengeTargets(challengeText: string, roles: string[]): string[] {
  const lower = challengeText.toLowerCase()
  return roles.filter((role) => {
    // Match any meaningful word from the role name (length > 3)
    return role
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.length > 3 && lower.includes(word))
  })
}

function parseStanceChanged(text: string): boolean {
  const section = extractSection(text, 'Stance').toLowerCase()
  if (!section) return false
  const changedKw = ['changed', 'revised', 'updated', 'reconsidered', 'shifted', 'concede', 'update my', 'now agree', 'move']
  const unchangedKw = ['unchanged', 'not changed', 'maintain', 'hold my', 'same position', 'still hold', 'stand by', 'no change']
  const c = changedKw.filter((k) => section.includes(k)).length
  const u = unchangedKw.filter((k) => section.includes(k)).length
  return c > u
}

// ── Types ────────────────────────────────────────────────────────────────────

interface NodeData {
  agent: Agent
  changed: boolean
  stanceText: string
  challengeText: string
  fullText: string
  targets: string[]
}

interface EdgeData {
  from: string
  to: string
  challengeText: string
  fromAgent: Agent
}

type Selection = { type: 'node'; role: string } | { type: 'edge'; from: string; to: string } | null

// ── Layout: fixed positions as ratios ────────────────────────────────────────

const LAYOUT: Record<number, Array<{ rx: number; ry: number }>> = {
  1: [{ rx: 0.5, ry: 0.5 }],
  2: [{ rx: 0.25, ry: 0.5 }, { rx: 0.75, ry: 0.5 }],
  3: [{ rx: 0.25, ry: 0.28 }, { rx: 0.75, ry: 0.28 }, { rx: 0.5, ry: 0.76 }],
  4: [{ rx: 0.22, ry: 0.26 }, { rx: 0.78, ry: 0.26 }, { rx: 0.22, ry: 0.76 }, { rx: 0.78, ry: 0.76 }],
  5: [{ rx: 0.2, ry: 0.22 }, { rx: 0.8, ry: 0.22 }, { rx: 0.5, ry: 0.52 }, { rx: 0.2, ry: 0.82 }, { rx: 0.8, ry: 0.82 }],
}

const NODE_W = 132
const NODE_H = 62

// Compute where a line from (sx,sy) exits the rectangle centered at (sx,sy) toward (tx,ty)
function rectEdgePoint(sx: number, sy: number, tx: number, ty: number, hw: number, hh: number): [number, number] {
  const dx = tx - sx
  const dy = ty - sy
  if (dx === 0 && dy === 0) return [sx, sy]
  // Parametric t to hit left/right edge vs top/bottom edge
  const tx_ = hw / Math.abs(dx || 1e-9)
  const ty_ = hh / Math.abs(dy || 1e-9)
  const t = Math.min(tx_, ty_)
  return [sx + dx * t, sy + dy * t]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StancePill({ changed, active }: { changed: boolean; active: boolean }) {
  if (!active) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.05em',
        padding: '2px 6px',
        borderRadius: 999,
        textTransform: 'uppercase',
        background: changed ? '#dcfce7' : '#f3f4f6',
        color: changed ? '#15803d' : '#6b7280',
        border: `1px solid ${changed ? '#bbf7d0' : '#e5e7eb'}`,
        lineHeight: 1.4,
      }}
    >
      {changed ? '✓ Changed' : 'Unchanged'}
    </span>
  )
}

function DetailPaneEmpty() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#c4c4cc',
        fontSize: 13,
        gap: 8,
        userSelect: 'none',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      Select an agent or arrow to explore
    </div>
  )
}

function DetailPaneNode({ node, onClose }: { node: NodeData; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const hasRound2 = Boolean(node.stanceText || node.challengeText)

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: node.agent.color, color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {node.agent.avatar}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 1 }}>
            Selected · Round 2
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b', lineHeight: 1.2 }}>{node.agent.name}</div>
        </div>
        <StancePill changed={node.changed} active={hasRound2} />
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {!hasRound2 ? (
        <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
          No Round 2 statement yet.
        </p>
      ) : (
        <>
          {node.challengeText && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                Challenge
              </div>
              <MarkdownContent content={node.challengeText} fontSize={13} />
            </div>
          )}
          {node.stanceText && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                Stance
              </div>
              <MarkdownContent content={node.stanceText} fontSize={13} />
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: '1px solid #e4e4e7', borderRadius: 6,
              padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#71717a',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {expanded ? 'Collapse' : 'Expand full statement'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
          </button>
          {expanded && (
            <div
              style={{
                marginTop: 12, padding: '12px 14px',
                background: '#fafafa', border: '1px solid #ececf1',
                borderRadius: 8,
              }}
            >
              <MarkdownContent content={node.fullText} fontSize={13} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DetailPaneEdge({ edge, nodes, onClose }: { edge: EdgeData; nodes: NodeData[]; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const toNode = nodes.find((n) => n.agent.seatRole === edge.to)

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: edge.fromAgent.color, color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {edge.fromAgent.avatar}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c4cc" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
        {toNode && (
          <span
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: toNode.agent.color, color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {toNode.agent.avatar}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 1 }}>
            Challenge
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.3 }}>
            {edge.fromAgent.name}
            <span style={{ color: '#a1a1aa', fontWeight: 400 }}> → </span>
            {toNode?.agent.name ?? edge.to}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {edge.challengeText ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
              The challenge
            </div>
            <MarkdownContent content={edge.challengeText} fontSize={13} />
          </div>
          {toNode?.stanceText && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                {toNode.agent.name}&rsquo;s stance
              </div>
              <MarkdownContent content={toNode.stanceText} fontSize={13} />
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: '1px solid #e4e4e7', borderRadius: 6,
              padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#71717a',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {expanded ? 'Collapse' : 'Expand full statement'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
          </button>
          {expanded && (
            <div
              style={{
                marginTop: 12, padding: '12px 14px',
                background: '#fafafa', border: '1px solid #ececf1',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 10 }}>
                {edge.fromAgent.name}&rsquo;s full Round 2 statement
              </div>
              <MarkdownContent content={nodes.find((n) => n.agent.seatRole === edge.from)?.fullText ?? ''} fontSize={13} />
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
          Challenge text unavailable.
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface DebateMapProps {
  session: DiscussionSession
}

export function DebateMap({ session }: DebateMapProps) {
  const [selected, setSelected] = useState<Selection>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapSize, setMapSize] = useState({ w: 600, h: 300 })

  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) setMapSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const round2Messages = useMemo(
    () => session.messages.filter((m) => m.round === 2 && m.isComplete),
    [session.messages],
  )

  const nonModAgents = useMemo(
    () => session.agents.filter((a) => a.seatRole !== 'Moderator'),
    [session.agents],
  )

  const allRoles = useMemo(() => nonModAgents.map((a) => a.seatRole), [nonModAgents])

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, NodeData>()

    // Pre-populate all non-moderator agents (so they show even without R2 data)
    for (const agent of nonModAgents) {
      nodeMap.set(agent.seatRole, {
        agent, changed: false,
        stanceText: '', challengeText: '', fullText: '', targets: [],
      })
    }

    const edgeList: EdgeData[] = []

    for (const msg of round2Messages) {
      const agent = session.agents.find((a) => a.id === msg.agentId)
      if (!agent) continue

      const text = getTextContent(msg)
      const challengeText = extractSection(text, 'Challenge')
      const stanceText = extractSection(text, 'Stance')
      const changed = parseStanceChanged(text)
      const targets = parseChallengeTargets(challengeText, allRoles).filter((r) => r !== agent.seatRole)

      nodeMap.set(agent.seatRole, {
        agent, changed, stanceText, challengeText, fullText: text, targets,
      })

      for (const target of targets) {
        // Avoid duplicate edges
        if (!edgeList.find((e) => e.from === agent.seatRole && e.to === target)) {
          edgeList.push({ from: agent.seatRole, to: target, challengeText, fromAgent: agent })
        }
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges: edgeList }
  }, [round2Messages, nonModAgents, allRoles, session.agents])

  const positions = useMemo(() => {
    const count = Math.min(nodes.length, 5)
    const layout = LAYOUT[count] ?? LAYOUT[5]
    return nodes.map((node, i) => {
      const ratio = layout[i] ?? layout[layout.length - 1]
      return { role: node.agent.seatRole, x: ratio.rx * mapSize.w, y: ratio.ry * mapSize.h }
    })
  }, [nodes, mapSize])

  const posMap = useMemo(() => new Map(positions.map((p) => [p.role, p])), [positions])

  const selectedNode = selected?.type === 'node' ? nodes.find((n) => n.agent.seatRole === selected.role) ?? null : null
  const selectedEdge = selected?.type === 'edge' ? edges.find((e) => e.from === selected.from && e.to === selected.to) ?? null : null

  const handleNodeClick = (role: string) => {
    setSelected((prev) => (prev?.type === 'node' && prev.role === role ? null : { type: 'node', role }))
  }

  const handleEdgeClick = (from: string, to: string) => {
    setSelected((prev) =>
      prev?.type === 'edge' && prev.from === from && prev.to === to
        ? null
        : { type: 'edge', from, to },
    )
  }

  const isEdgeSelected = (from: string, to: string) =>
    selected?.type === 'edge' && selected.from === from && selected.to === to

  const isNodeSelected = (role: string) => selected?.type === 'node' && selected.role === role

  if (round2Messages.length === 0) {
    return (
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, color: '#a1a1aa', padding: '40px 20px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: 3 }}>Debate map</div>
          <div style={{ fontSize: 12, color: '#c4c4cc' }}>Available after Round 2 completes</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Map canvas */}
      <div
        ref={mapRef}
        style={{
          flex: '0 0 300px',
          position: 'relative',
          background: '#fafafa',
          borderBottom: '1px solid #ececf1',
          overflow: 'hidden',
        }}
      >
        {/* SVG layer for edges */}
        <svg
          width={mapSize.w}
          height={mapSize.h}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,1 L0,6 L7,3.5 z" fill="#d1d5db" />
            </marker>
            <marker id="arrowhead-sel" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,1 L0,6 L7,3.5 z" fill="#374151" />
            </marker>
          </defs>

          {edges.map((edge, i) => {
            const fp = posMap.get(edge.from)
            const tp = posMap.get(edge.to)
            if (!fp || !tp) return null
            const [x1, y1] = rectEdgePoint(fp.x, fp.y, tp.x, tp.y, NODE_W / 2 + 2, NODE_H / 2 + 2)
            const [x2, y2] = rectEdgePoint(tp.x, tp.y, fp.x, fp.y, NODE_W / 2 + 14, NODE_H / 2 + 10)
            const isSel = isEdgeSelected(edge.from, edge.to)

            return (
              <g key={i}>
                {/* Wide invisible hit area */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={() => handleEdgeClick(edge.from, edge.to)}
                />
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isSel ? '#374151' : '#d1d5db'}
                  strokeWidth={isSel ? 2 : 1.5}
                  markerEnd={isSel ? 'url(#arrowhead-sel)' : 'url(#arrowhead)'}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}
        </svg>

        {/* Agent nodes */}
        {nodes.map((node, i) => {
          const pos = positions[i]
          if (!pos) return null
          const isSel = isNodeSelected(node.agent.seatRole)
          const hasR2 = round2Messages.some((m) => m.agentId === node.agent.id)

          return (
            <div
              key={node.agent.id}
              onClick={() => handleNodeClick(node.agent.seatRole)}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
                background: '#fff',
                border: `1.5px solid ${isSel ? node.agent.color : '#e4e4e7'}`,
                borderRadius: 10,
                padding: '8px 10px',
                cursor: 'pointer',
                boxShadow: isSel
                  ? `0 0 0 3px ${node.agent.color}1f, 0 2px 8px rgba(0,0,0,0.08)`
                  : '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'border-color 120ms, box-shadow 120ms',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: node.agent.color, color: '#fff',
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {node.agent.avatar}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#18181b',
                    lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {node.agent.name}
                </span>
              </div>
              <StancePill changed={node.changed} active={hasR2} />
            </div>
          )
        })}
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#fff' }}>
        {!selected && <DetailPaneEmpty />}
        {selectedNode && (
          <DetailPaneNode node={selectedNode} onClose={() => setSelected(null)} />
        )}
        {selectedEdge && !selectedNode && (
          <DetailPaneEdge edge={selectedEdge} nodes={nodes} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}
