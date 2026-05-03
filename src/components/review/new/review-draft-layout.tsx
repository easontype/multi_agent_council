'use client'

import { PaperPreview } from '@/components/council/paper-preview'
import { PAPER_TOPIC_PRESETS } from '@/lib/paper-topics'
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
  cacheStatus: 'ready' | 'processing' | 'failed' | 'unknown' | null
  notice?: string | null
  topicPresetId: string
  selectedTopicLabel: string
  customTopic: string
  customGoal: string
  topicError: string | null
  canContinue: boolean
  onTopicPresetChange: (presetId: string) => void
  onCustomTopicChange: (value: string) => void
  onCustomGoalChange: (value: string) => void
  onContinue: () => void
}

function PaperSourceStep({
  sourceDraft,
  onSourceDraftChange,
  onSourceSubmit,
  onFileChange,
  cacheStatus,
}: {
  sourceDraft: string
  onSourceDraftChange: (value: string) => void
  onSourceSubmit: (event: React.FormEvent) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  cacheStatus: 'ready' | 'processing' | 'failed' | 'unknown' | null
}) {
  const cacheTone = cacheStatus === 'ready'
    ? { label: 'Cached', bg: '#ecfdf5', border: '#bbf7d0', color: '#166534' }
    : cacheStatus === 'processing'
      ? { label: 'Processing', bg: '#fffbeb', border: '#fde68a', color: '#92400e' }
      : cacheStatus === 'failed'
        ? { label: 'Retry needed', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
        : { label: 'Unknown', bg: '#f5f5f4', border: '#e7e5e4', color: '#57534e' }
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
        {cacheStatus && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
            border: `1px solid ${cacheTone.border}`,
            background: cacheTone.bg,
            color: cacheTone.color,
            borderRadius: 999,
            padding: '7px 11px',
            fontSize: 11.5,
            fontWeight: 600,
          }}>
            Cache: {cacheTone.label}
          </div>
        )}

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

function TopicSelectionStep({
  topicPresetId,
  customTopic,
  customGoal,
  topicError,
  onTopicPresetChange,
  onCustomTopicChange,
  onCustomGoalChange,
}: {
  topicPresetId: string
  customTopic: string
  customGoal: string
  topicError: string | null
  onTopicPresetChange: (presetId: string) => void
  onCustomTopicChange: (value: string) => void
  onCustomGoalChange: (value: string) => void
}) {
  return (
    <ReviewSectionFrame
      eyebrow="Step 1b"
      title="Review focus"
      description="Choose what this panel should concentrate on before the debate starts."
    >
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
          {PAPER_TOPIC_PRESETS.map((preset) => {
            const active = topicPresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onTopicPresetChange(preset.id)}
                style={{
                  textAlign: 'left',
                  border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                  borderRadius: 14,
                  background: active ? '#111827' : '#fff',
                  color: active ? '#fff' : '#18181b',
                  padding: '13px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{preset.label}</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.55, color: active ? 'rgba(255,255,255,0.76)' : '#71717a' }}>
                  {preset.id === 'custom' ? 'Write your own review question.' : preset.topic}
                </div>
              </button>
            )
          })}
        </div>

        {topicPresetId === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              value={customTopic}
              onChange={(event) => onCustomTopicChange(event.target.value)}
              placeholder="Custom review topic"
              style={{
                border: `1px solid ${topicError ? '#fca5a5' : reviewTheme.colors.borderStrong}`,
                borderRadius: 12,
                padding: '11px 12px',
                fontSize: 13,
                color: reviewTheme.colors.ink,
                background: '#fffdfa',
                outline: 'none',
              }}
            />
            <textarea
              value={customGoal}
              onChange={(event) => onCustomGoalChange(event.target.value)}
              placeholder="Optional: what exactly should the panel decide or verify?"
              rows={3}
              style={{
                border: `1px solid ${reviewTheme.colors.border}`,
                borderRadius: 12,
                padding: '11px 12px',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: reviewTheme.colors.ink,
                background: '#fff',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            {topicError && (
              <div style={{ fontSize: 12, color: '#b91c1c', lineHeight: 1.5 }}>
                {topicError}
              </div>
            )}
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
    cacheStatus,
    notice,
    topicPresetId,
    selectedTopicLabel,
    customTopic,
    customGoal,
    topicError,
    canContinue,
    onTopicPresetChange,
    onCustomTopicChange,
    onCustomGoalChange,
    onContinue,
  } = props

  const draftStatus = !hasSource
    ? 'Select a paper source to continue.'
    : topicError
      ? topicError
      : 'Ready to configure the review team.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ReviewCreateHeader hasSource={hasSource} />

      <ReviewPageBody>
        <div className="review-draft-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.5fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <ReviewSectionFrame
              eyebrow="Step 1a"
              title="Paper source"
              description="Stage the paper before configuring the panel."
            >
              {!hasSource && (
                <PaperSourceStep
                  sourceDraft={sourceDraft}
                  onSourceDraftChange={onSourceDraftChange}
                  onSourceSubmit={onSourceSubmit}
                  onFileChange={onFileChange}
                  cacheStatus={cacheStatus}
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
                {hasSource && cacheStatus && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginBottom: 12,
                    border: `1px solid ${cacheStatus === 'ready' ? '#bbf7d0' : cacheStatus === 'processing' ? '#fde68a' : cacheStatus === 'failed' ? '#fecaca' : '#e7e5e4'}`,
                    background: cacheStatus === 'ready' ? '#ecfdf5' : cacheStatus === 'processing' ? '#fffbeb' : cacheStatus === 'failed' ? '#fef2f2' : '#f5f5f4',
                    color: cacheStatus === 'ready' ? '#166534' : cacheStatus === 'processing' ? '#92400e' : cacheStatus === 'failed' ? '#b91c1c' : '#57534e',
                    borderRadius: 999,
                    padding: '7px 11px',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}>
                    Cache: {cacheStatus === 'ready' ? 'Cached' : cacheStatus === 'processing' ? 'Processing' : cacheStatus === 'failed' ? 'Retry needed' : 'Unknown'}
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

            <TopicSelectionStep
              topicPresetId={topicPresetId}
              customTopic={customTopic}
              customGoal={customGoal}
              topicError={topicError}
              onTopicPresetChange={onTopicPresetChange}
              onCustomTopicChange={onCustomTopicChange}
              onCustomGoalChange={onCustomGoalChange}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ReviewRailCard eyebrow="Continue" accent>
                <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginBottom: 8, fontFamily: reviewTheme.fonts.display }}>
                  Choose the paper, then configure the team.
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', marginBottom: 16 }}>
                  {draftStatus}
                </div>
                <ReviewActionButton
                  variant="primary"
                  disabled={!canContinue}
                  onClick={onContinue}
                  style={{
                    width: '100%',
                    background: canContinue ? '#fff' : 'rgba(255,255,255,0.22)',
                    color: canContinue ? '#111827' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  Continue →
                </ReviewActionButton>
              </ReviewRailCard>

              <ReviewRailCard eyebrow="Draft Summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ReviewSummaryItem label="Paper" value={hasSource ? sourceLabel : 'Not selected'} tone={hasSource ? '#18181b' : '#b45309'} />
                  <ReviewSummaryItem
                    label="Focus"
                    value={selectedTopicLabel === 'Custom' && customTopic.trim() ? customTopic.trim() : selectedTopicLabel}
                  />
                </div>
              </ReviewRailCard>
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 900px) {
            .review-draft-grid {
              grid-template-columns: 1fr !important;
              gap: 14px !important;
            }
          }
        `}</style>
      </ReviewPageBody>
    </div>
  )
}
