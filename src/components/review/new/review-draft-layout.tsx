'use client'

import { PaperPreview } from '@/components/council/paper-preview'
import { ReviewSetupPanel } from '@/components/council/review-setup-panel'
import type { EditableReviewAgent, ReviewMode } from '@/lib/prompts/review-presets'
import type { SavedTeamTemplate } from '@/lib/team-template-store'
import {
  ReviewActionButton,
  ReviewPageBody,
  ReviewRailCard,
  ReviewSectionFrame,
  ReviewSummaryItem,
} from '../review-primitives'
import { ReviewCreateHeader } from './review-create-header'
import { reviewTheme, subtleButtonStyle } from '../review-theme'

interface ReviewDraftLayoutProps {
  paperTitle: string
  paperSummary: string
  sourceLabel: string
  sourceHref: string | null
  pdfUrl: string | null
  sourceDraft: string
  onSourceDraftChange: (value: string) => void
  onSourceSubmit: (event: React.FormEvent) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  hasSource: boolean
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  busy: boolean
  canStart: boolean
  costLabel: string
  error: string | null
  notice?: string | null
  activeCount: number
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

function PaperSourceStep({
  sourceDraft,
  onSourceDraftChange,
  onSourceSubmit,
  onFileChange,
}: {
  sourceDraft: string
  onSourceDraftChange: (value: string) => void
  onSourceSubmit: (event: React.FormEvent) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        border: `1px solid ${reviewTheme.colors.border}`,
        borderRadius: 16,
        background: '#fff',
        padding: '18px',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: reviewTheme.colors.ink, marginBottom: 6 }}>
          Choose a source
        </div>
        <div style={{ fontSize: 12.5, color: reviewTheme.colors.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Paste an arXiv ID or upload a PDF. The file is staged immediately, but ingestion only starts once you launch the review.
        </div>

        <form onSubmit={onSourceSubmit} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="text"
            value={sourceDraft}
            onChange={(event) => onSourceDraftChange(event.target.value)}
            placeholder="arXiv ID e.g. 1706.03762"
            style={{
              flex: 1,
              border: `1px solid ${reviewTheme.colors.borderStrong}`,
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              color: reviewTheme.colors.ink,
              outline: 'none',
              background: '#fffdfa',
            }}
          />
          <button
            type="submit"
            disabled={!sourceDraft.trim()}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              background: sourceDraft.trim() ? reviewTheme.colors.accent : reviewTheme.colors.borderStrong,
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
          ...subtleButtonStyle({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px dashed ${reviewTheme.colors.borderStrong}`,
            borderRadius: 10,
            background: 'rgba(248,242,232,0.42)',
            color: '#3f3f46',
            padding: '10px 13px',
            fontSize: 12.5,
            fontWeight: 600,
          }),
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
    </div>
  )
}

function SavedTemplatesPanel({
  savedTemplates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
}: {
  savedTemplates: SavedTeamTemplate[]
  onSaveTemplate: () => void
  onLoadTemplate: (template: SavedTeamTemplate) => void
  onDeleteTemplate: (id: string) => void
  onRenameTemplate: (template: SavedTeamTemplate) => void
  onDuplicateTemplate: (template: SavedTeamTemplate) => void
}) {
  return (
    <ReviewSectionFrame
      eyebrow="Step 3"
      title="Templates"
      description="Save a panel configuration you expect to reuse across papers, or load an existing one before launch."
    >
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: reviewTheme.colors.muted }}>
            Saved team presets
          </div>
          <button
            type="button"
            onClick={onSaveTemplate}
            style={subtleButtonStyle({ padding: '7px 12px', fontSize: 12, fontWeight: 600 })}
          >
            Save Current Setup
          </button>
        </div>

        {savedTemplates.length === 0 ? (
          <div style={{
            border: `1px dashed ${reviewTheme.colors.border}`,
            borderRadius: 14,
            background: 'rgba(248,242,232,0.46)',
            padding: '18px',
            fontSize: 12.5,
            color: reviewTheme.colors.softMuted,
          }}>
            No saved teams yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedTemplates.slice(0, 4).map((template) => (
              <div
                key={template.id}
                style={{
                  border: '1px solid #ececf1',
                  borderRadius: 14,
                  padding: '12px 13px',
                  background: '#fcfcfb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{template.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {template.agents.filter((agent) => agent.enabled).length} agents
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginBottom: 10 }}>
                  {template.mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'} · {template.rounds} round{template.rounds > 1 ? 's' : ''}
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
                        border: '1px solid #d4d4d8',
                        background: '#fff',
                        color: '#3f3f46',
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(template.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#a1a1aa',
                      borderRadius: 999,
                      padding: '6px 2px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
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
    </ReviewSectionFrame>
  )
}

export function ReviewDraftLayout(props: ReviewDraftLayoutProps) {
  const {
    paperTitle,
    paperSummary,
    sourceLabel,
    sourceHref,
    pdfUrl,
    sourceDraft,
    onSourceDraftChange,
    onSourceSubmit,
    onFileChange,
    hasSource,
    mode,
    rounds,
    agents,
    busy,
    canStart,
    costLabel,
    error,
    notice,
    activeCount,
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
  } = props
  const enabledCount = agents.filter((agent) => agent.enabled).length
  const startDisabled = busy || !canStart || enabledCount < 2
  const modeLabel = mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'
  const draftStatus = !hasSource
    ? 'Select a paper source to unlock launch.'
    : enabledCount < 2
      ? 'Keep at least two active agents before launch.'
      : busy
        ? 'Council is preparing the ingest and runtime.'
        : 'Draft is ready to launch.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ReviewCreateHeader hasSource={hasSource} activeCount={activeCount} rounds={rounds} />

      <ReviewPageBody>
        <div className="review-draft-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.06fr) minmax(320px, 0.94fr) minmax(260px, 0.5fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <ReviewSectionFrame
              eyebrow="Step 1"
              title="Paper source"
              description="Stage the paper before configuring the panel. This is the only paper-selection step in the review flow."
            >
              {!hasSource && (
                <PaperSourceStep
                  sourceDraft={sourceDraft}
                  onSourceDraftChange={onSourceDraftChange}
                  onSourceSubmit={onSourceSubmit}
                  onFileChange={onFileChange}
                />
              )}
              <div style={{ padding: hasSource ? 20 : '0 20px 20px' }}>
                {notice && (
                  <div
                    style={{
                      marginBottom: 12,
                      border: `1px solid ${reviewTheme.colors.warningBorder}`,
                      background: reviewTheme.colors.warningBg,
                      color: reviewTheme.colors.warningText,
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                    }}
                  >
                    {notice}
                  </div>
                )}
                <div style={{
                  border: '1px solid #ececf1',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: '#fff',
                }}>
                  <PaperPreview
                    title={paperTitle}
                    sourceLabel={sourceLabel}
                    pdfUrl={pdfUrl}
                    sourceHref={sourceHref}
                    helperText="The preview is live now. Council will only parse and index the paper after you launch the review."
                  />
                </div>
              </div>
            </ReviewSectionFrame>

            <SavedTemplatesPanel
              savedTemplates={savedTemplates}
              onSaveTemplate={onSaveTemplate}
              onLoadTemplate={onLoadTemplate}
              onDeleteTemplate={onDeleteTemplate}
              onRenameTemplate={onRenameTemplate}
              onDuplicateTemplate={onDuplicateTemplate}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <ReviewSectionFrame
              eyebrow="Step 2"
              title="Review setup"
              description="Choose the review mode, define the debate depth, and edit the seats that will participate in the council."
            >
              <ReviewSetupPanel
                paperTitle={paperTitle}
                paperSummary={paperSummary}
                sourceLabel={sourceLabel}
                mode={mode}
                rounds={rounds}
                agents={agents}
                busy={busy}
                canStart={canStart}
                costLabel={costLabel}
                error={error}
                onModeChange={onModeChange}
                onRoundsChange={onRoundsChange}
                onAgentsChange={onAgentsChange}
                onAddAgent={onAddAgent}
                onStart={onStart}
                showLaunchFooter={false}
              />
            </ReviewSectionFrame>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ReviewRailCard eyebrow="Launch Review" accent>
                <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginBottom: 8, fontFamily: reviewTheme.fonts.display }}>
                  Confirm the draft, then start the council.
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', marginBottom: 16 }}>
                  {draftStatus}
                </div>
                <ReviewActionButton
                  variant="primary"
                  disabled={startDisabled}
                  onClick={onStart}
                  style={{
                    width: '100%',
                    background: startDisabled ? 'rgba(255,255,255,0.22)' : '#fff',
                    color: startDisabled ? 'rgba(255,255,255,0.7)' : '#111827',
                    marginBottom: 10,
                  }}
                >
                  {busy ? 'Preparing...' : 'Start Review'}
                </ReviewActionButton>
                <ReviewActionButton
                  onClick={onSaveTemplate}
                  style={{
                    width: '100%',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 12,
                    padding: '11px 14px',
                    background: 'transparent',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  Save Current Setup
                </ReviewActionButton>
              </ReviewRailCard>

              <ReviewRailCard eyebrow="Draft Summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ReviewSummaryItem label="Paper" value={hasSource ? sourceLabel : 'Not selected'} tone={hasSource ? '#18181b' : '#b45309'} />
                  <ReviewSummaryItem label="Mode" value={modeLabel} />
                  <ReviewSummaryItem label="Rounds" value={`${rounds} round${rounds > 1 ? 's' : ''}`} />
                  <ReviewSummaryItem label="Active Seats" value={`${enabledCount} active`} tone={enabledCount >= 2 ? '#18181b' : '#b91c1c'} />
                  <ReviewSummaryItem label="Estimated Cost" value={costLabel} />
                </div>
              </ReviewRailCard>

              <ReviewRailCard eyebrow="Templates">
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: reviewTheme.colors.muted, marginBottom: 10 }}>
                  {savedTemplates.length > 0
                    ? `${savedTemplates.length} saved team template${savedTemplates.length > 1 ? 's' : ''} available in this workspace.`
                    : 'No saved team templates yet. Save this setup if you expect to reuse it.'}
                </div>
                {savedTemplates.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {savedTemplates.slice(0, 3).map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => onLoadTemplate(template)}
                        style={{
                          textAlign: 'left',
                          border: '1px solid #ececf1',
                          background: '#fcfcfb',
                          borderRadius: 12,
                          padding: '10px 11px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', marginBottom: 3 }}>
                          {template.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#71717a' }}>
                          {template.mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'} · {template.rounds} round{template.rounds > 1 ? 's' : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ReviewRailCard>
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 1200px) {
            .review-draft-grid {
              grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr) !important;
            }
            .review-draft-grid > :nth-child(3) {
              grid-column: 1 / -1;
            }
          }
          @media (max-width: 900px) {
            .review-draft-grid {
              grid-template-columns: 1fr !important;
              gap: 14px !important;
            }
            .review-draft-grid > :nth-child(3) {
              grid-column: auto;
            }
          }
        `}</style>
      </ReviewPageBody>
    </div>
  )
}
