'use client'

import { ReviewSetupPanel } from '@/components/council/review-setup-panel'
import { ChevronIcon } from './icons'
import type { EditableReviewAgent, ReviewMode } from '@/lib/review-presets'
import type { SavedTeamTemplate } from '@/lib/team-template-store'

interface SetupSidebarProps {
  isOpen: boolean
  onToggle: () => void
  paperTitle: string
  paperSummary: string
  sourceLabel: string
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  isPreparing: boolean
  canStart: boolean
  costLabel: string
  error: string | null
  activeCount: number
  costEstimateMin: number
  costEstimateMax: number
  savedTemplates: SavedTeamTemplate[]
  onModeChange: (mode: ReviewMode) => void
  onRoundsChange: (rounds: 1 | 2) => void
  onAgentsChange: (agents: EditableReviewAgent[]) => void
  onAddAgent: () => void
  onStart: () => void
  onSaveTemplate: () => void
  onLoadTemplate: (template: SavedTeamTemplate) => void
  onDeleteTemplate: (id: string) => void
  onRenameTemplate: (template: SavedTeamTemplate) => void
  onDuplicateTemplate: (template: SavedTeamTemplate) => void
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

export function SetupSidebar({
  isOpen,
  onToggle,
  paperTitle,
  paperSummary,
  sourceLabel,
  mode,
  rounds,
  agents,
  isPreparing,
  canStart,
  costLabel,
  error,
  activeCount,
  costEstimateMin,
  costEstimateMax,
  savedTemplates,
  onModeChange,
  onRoundsChange,
  onAgentsChange,
  onAddAgent,
  onStart,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
}: SetupSidebarProps) {
  return (
    <div style={{
      width: isOpen ? 460 : 76,
      minWidth: isOpen ? 360 : 76,
      background: '#fafafa',
      borderLeft: '1px solid #ececf1',
      transition: 'width 180ms ease, min-width 180ms ease',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse review setup sidebar' : 'Expand review setup sidebar'}
        style={{
          position: 'absolute', top: 18, left: 14, zIndex: 2,
          width: 34, height: 34,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #e4e4e7', borderRadius: 999,
          background: '#fff', color: '#52525b', cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
        }}
      >
        <ChevronIcon direction={isOpen ? 'right' : 'left'} />
      </button>

      {isOpen ? (
        <div style={{ height: '100%', overflowY: 'auto', padding: '18px 18px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 14, paddingLeft: 44,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 4 }}>
                Review Setup
              </div>
            </div>
          </div>

          <ReviewSetupPanel
            paperTitle={paperTitle}
            paperSummary={paperSummary}
            sourceLabel={sourceLabel}
            mode={mode}
            rounds={rounds}
            agents={agents}
            busy={isPreparing}
            canStart={canStart}
            costLabel={costLabel}
            error={error}
            onModeChange={onModeChange}
            onRoundsChange={onRoundsChange}
            onAgentsChange={onAgentsChange}
            onAddAgent={onAddAgent}
            onStart={onStart}
          />

          <div style={{
            background: '#fff', border: '1px solid #ebebed',
            borderRadius: 14, padding: '15px 16px', marginTop: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
                Saved Teams
              </div>
              <button
                type="button"
                onClick={onSaveTemplate}
                style={{
                  border: '1px solid #e4e4e7', background: '#fafafa', color: '#3f3f46',
                  borderRadius: 999, padding: '6px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save Current
              </button>
            </div>
            {savedTemplates.length === 0 ? (
              <div style={{ fontSize: 12, color: '#a1a1aa' }}>No saved teams.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedTemplates.slice(0, 4).map((template) => (
                  <div
                    key={template.id}
                    style={{ border: '1px solid #ececf1', borderRadius: 12, padding: '10px 12px', background: '#fafafa' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{template.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {template.agents.filter((a) => a.enabled).length} agents
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a', marginBottom: 8 }}>
                      {template.mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'} - {template.rounds} round{template.rounds > 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['Load', 'Duplicate', 'Rename'] as const).map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            if (label === 'Load') onLoadTemplate(template)
                            else if (label === 'Duplicate') onDuplicateTemplate(template)
                            else onRenameTemplate(template)
                          }}
                          style={{
                            border: '1px solid #d4d4d8', background: '#fff', color: '#3f3f46',
                            borderRadius: 999, padding: '6px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(template.id)}
                        style={{
                          border: 'none', background: 'transparent', color: '#a1a1aa',
                          borderRadius: 999, padding: '6px 2px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '64px 10px 20px', gap: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#a1a1aa', textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Review Setup
          </div>
          <div style={{
            width: '100%', border: '1px solid #ececf1', borderRadius: 16,
            background: '#fff', padding: '12px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agents</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#18181b' }}>{activeCount}</div>
            <div style={{ width: '100%', height: 1, background: '#ececf1' }} />
            <div style={{ fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#18181b', textAlign: 'center', lineHeight: 1.45 }}>
              {formatUsd(costEstimateMin)}
              <br />
              {formatUsd(costEstimateMax)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
