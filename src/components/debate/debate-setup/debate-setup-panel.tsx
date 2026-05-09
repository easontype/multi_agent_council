'use client'

import { useState } from 'react'
import { REVIEW_DOMAIN_OPTIONS, type ReviewDomain } from '@/lib/prompts/review-presets'
import {
  CRITIQUE_SEAT_DEFINITIONS,
  EXPERIMENTAL_SEAT_DEFINITIONS,
  BIOMEDICAL_SEAT_DEFINITIONS,
  PHYSICS_SEAT_DEFINITIONS,
} from '@/lib/core/council-academic'
import { reviewTheme, softCard, sectionEyebrowStyle } from '@/components/review/review-theme'
import { ReviewPageBody, ReviewSectionFrame, ReviewRailCard, ReviewSummaryItem, ReviewActionButton } from '@/components/review/review-primitives'
import { TopicInput } from './topic-input'
import { RoleSelector } from './role-selector'
import { setPendingUpload } from '@/lib/pending-upload'

interface DebateSetupPanelProps {
  step: number
  optionA: string
  optionB: string
  context: string
  domain: ReviewDomain
  selectedRoleIds: string[]
  arxivId: string | null
  hasPendingFile: boolean
  phase: string
  error: string | null
  onStepChange: (step: number) => void
  onOptionAChange: (v: string) => void
  onOptionBChange: (v: string) => void
  onContextChange: (v: string) => void
  onDomainChange: (d: ReviewDomain) => void
  onSelectedRoleIdsChange: (ids: string[]) => void
  onArxivIdChange: (id: string | null) => void
  onFileSelect: (file: File) => void
  onStart: () => void
}

function seatsForDomain(domain: ReviewDomain) {
  switch (domain) {
    case 'materials': return EXPERIMENTAL_SEAT_DEFINITIONS
    case 'biomedical': return BIOMEDICAL_SEAT_DEFINITIONS
    case 'physics': return PHYSICS_SEAT_DEFINITIONS
    default: return CRITIQUE_SEAT_DEFINITIONS
  }
}

const STEP_LABELS = ['Upload Paper', 'Debate Topic', 'Research Domain', 'Debate Angles']

function StepHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number
  totalSteps: number
  onBack: () => void
}) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 24px',
      height: 54,
      flexShrink: 0,
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid #ececf1',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    }}>
      {step > 1 && (
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#52525b',
            border: '1px solid #e4e4e7',
            borderRadius: 8,
            padding: '5px 10px',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      )}
      {step === 1 && (
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#52525b',
            border: '1px solid #e4e4e7',
            borderRadius: 8,
            padding: '5px 10px',
            background: '#fff',
            textDecoration: 'none',
          }}
        >
          ← Home
        </a>
      )}
      <div style={{ width: 1, height: 28, background: '#ebebed' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 1 }}>
          Step {step} of {totalSteps}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>
          {STEP_LABELS[step - 1]}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
        {STEP_LABELS.map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 999,
              background: i < step ? reviewTheme.colors.accent : '#e4e4e7',
              transition: 'background 300ms',
            }}
          />
        ))}
      </div>
    </header>
  )
}

export function DebateSetupPanel({
  step,
  optionA,
  optionB,
  context,
  domain,
  selectedRoleIds,
  arxivId,
  hasPendingFile,
  phase,
  error,
  onStepChange,
  onOptionAChange,
  onOptionBChange,
  onContextChange,
  onDomainChange,
  onSelectedRoleIdsChange,
  onArxivIdChange,
  onFileSelect,
  onStart,
}: DebateSetupPanelProps) {
  const [arxivDraft, setArxivDraft] = useState('')
  const hasSource = Boolean(arxivId || hasPendingFile)
  const topicValid = optionA.trim().length > 0 && optionB.trim().length > 0
  const rolesValid = selectedRoleIds.length >= 2

  const domainLabel = REVIEW_DOMAIN_OPTIONS.find((o) => o.value === domain)?.label ?? 'General Academic'
  const seats = seatsForDomain(domain)
  const busy = phase === 'ingesting'

  const handleArxivSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = arxivDraft.trim()
    if (!id) return
    onArxivIdChange(id)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingUpload(file)
    onFileSelect(file)
    e.target.value = ''
  }

  const toggleRole = (id: string) => {
    if (selectedRoleIds.includes(id)) {
      onSelectedRoleIdsChange(selectedRoleIds.filter((r) => r !== id))
    } else {
      onSelectedRoleIdsChange([...selectedRoleIds, id])
    }
  }

  const stepCanAdvance = [
    hasSource,
    topicValid,
    true,
    rolesValid,
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
      fontFamily: reviewTheme.fonts.body,
    }}>
      <StepHeader
        step={step}
        totalSteps={4}
        onBack={() => onStepChange(step - 1)}
      />

      <div style={{
        padding: '28px 36px 20px',
        borderBottom: `1px solid ${reviewTheme.colors.border}`,
        background: 'linear-gradient(180deg, #fbfaf6 0%, #f3efe7 100%)',
        flexShrink: 0,
      }}>
        <div style={sectionEyebrowStyle({ marginBottom: 6 })}>Adversarial Debate</div>
        <h1 style={{
          margin: 0,
          fontSize: 28,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          color: reviewTheme.colors.ink,
          fontFamily: reviewTheme.fonts.display,
        }}>
          Compare two options with AI debate.
        </h1>
      </div>

      <ReviewPageBody>
        <div className="debate-setup-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 0.5fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

            {/* Step 1: Paper Upload */}
            {step === 1 && (
              <ReviewSectionFrame
                eyebrow="Step 1"
                title="Upload paper"
                description="Provide a paper as the evidence base. Agents will find supporting arguments within it."
              >
                <div style={{ padding: '20px' }}>
                  <div style={{
                    border: `1px solid ${reviewTheme.colors.border}`,
                    borderRadius: 16,
                    background: '#fff',
                    padding: '18px',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: reviewTheme.colors.ink, marginBottom: 6 }}>
                      Choose a source
                    </div>
                    <div style={{ fontSize: 12.5, color: reviewTheme.colors.muted, lineHeight: 1.6, marginBottom: 14 }}>
                      Paste an arXiv ID or upload a PDF. The paper provides the evidence base for the debate.
                    </div>

                    {hasSource && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 14,
                        border: '1px solid #bbf7d0',
                        background: '#ecfdf5',
                        color: '#166534',
                        borderRadius: 999,
                        padding: '7px 11px',
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {arxivId ? `arXiv: ${arxivId}` : 'PDF uploaded'}
                      </div>
                    )}

                    <form onSubmit={handleArxivSubmit} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input
                        type="text"
                        value={arxivDraft}
                        onChange={(e) => setArxivDraft(e.target.value)}
                        placeholder="arXiv ID e.g. 2401.00123"
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
                        disabled={!arxivDraft.trim()}
                        style={{
                          border: 'none',
                          borderRadius: 10,
                          padding: '10px 14px',
                          background: arxivDraft.trim() ? reviewTheme.colors.accent : reviewTheme.colors.borderStrong,
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: arxivDraft.trim() ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Use arXiv
                      </button>
                    </form>

                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: `1px dashed ${reviewTheme.colors.borderStrong}`,
                      borderRadius: 10,
                      background: 'rgba(248,242,232,0.42)',
                      color: '#3f3f46',
                      padding: '10px 13px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      Upload PDF
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </ReviewSectionFrame>
            )}

            {/* Step 2: Topic */}
            {step === 2 && (
              <ReviewSectionFrame
                eyebrow="Step 2"
                title="Debate topic"
                description="Name the two options you want to compare. Each role will be mirrored across both sides."
              >
                <TopicInput
                  optionA={optionA}
                  optionB={optionB}
                  context={context}
                  onOptionAChange={onOptionAChange}
                  onOptionBChange={onOptionBChange}
                  onContextChange={onContextChange}
                />
              </ReviewSectionFrame>
            )}

            {/* Step 3: Domain */}
            {step === 3 && (
              <ReviewSectionFrame
                eyebrow="Step 3"
                title="Research domain"
                description="Pick the domain — this determines which specialist roles are available for the debate."
              >
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {REVIEW_DOMAIN_OPTIONS.filter((o) => o.value !== 'general').concat(REVIEW_DOMAIN_OPTIONS.filter((o) => o.value === 'general')).map((opt) => {
                      const active = domain === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onDomainChange(opt.value)
                            onSelectedRoleIdsChange([])
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '14px 14px',
                            borderRadius: 13,
                            border: `1.5px solid ${active ? reviewTheme.colors.accent : reviewTheme.colors.border}`,
                            background: active ? `${reviewTheme.colors.accent}0d` : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: `2px solid ${active ? reviewTheme.colors.accent : reviewTheme.colors.borderStrong}`,
                              background: active ? reviewTheme.colors.accent : '#fff',
                              flexShrink: 0,
                            }} />
                            <div style={{ fontSize: 13, fontWeight: 600, color: active ? reviewTheme.colors.accent : reviewTheme.colors.ink }}>
                              {opt.label}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, lineHeight: 1.55, color: reviewTheme.colors.softMuted, paddingLeft: 22 }}>
                            {opt.subtitle}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </ReviewSectionFrame>
            )}

            {/* Step 4: Roles */}
            {step === 4 && (
              <ReviewSectionFrame
                eyebrow="Step 4"
                title="Debate angles"
                description="Select 2–3 specialist roles. Each role will be mirrored: one supporting each option."
              >
                <RoleSelector
                  seats={seats}
                  selectedIds={selectedRoleIds}
                  optionA={optionA}
                  optionB={optionB}
                  onToggle={toggleRole}
                  maxSelect={3}
                />
              </ReviewSectionFrame>
            )}

            {/* Error */}
            {error && (
              <div style={{
                borderRadius: 12,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.65,
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Rail */}
          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ReviewRailCard eyebrow={step < 4 ? 'Next step' : 'Start debate'} accent>
                <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, marginBottom: 8, fontFamily: reviewTheme.fonts.display }}>
                  {step === 1 && 'Choose a paper source.'}
                  {step === 2 && 'Name the two options.'}
                  {step === 3 && 'Pick your research domain.'}
                  {step === 4 && (rolesValid ? 'Panel is ready to launch.' : 'Select at least 2 roles.')}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', marginBottom: 16 }}>
                  {step === 1 && (!hasSource ? 'Add an arXiv ID or upload a PDF to continue.' : 'Paper staged — proceed to topic setup.')}
                  {step === 2 && (!topicValid ? 'Both option names are required.' : 'Topic set — choose your domain next.')}
                  {step === 3 && 'Domain determines which specialist roles are available.'}
                  {step === 4 && (rolesValid ? `${selectedRoleIds.length * 2} debate seats + 1 Moderator ready.` : 'Choose 2–3 roles to build the mirror teams.')}
                </div>
                {step < 4 ? (
                  <ReviewActionButton
                    variant="primary"
                    disabled={!stepCanAdvance[step - 1]}
                    onClick={() => onStepChange(step + 1)}
                    style={{
                      width: '100%',
                      background: stepCanAdvance[step - 1] ? '#fff' : 'rgba(255,255,255,0.22)',
                      color: stepCanAdvance[step - 1] ? '#111827' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    Continue →
                  </ReviewActionButton>
                ) : (
                  <ReviewActionButton
                    variant="primary"
                    disabled={!rolesValid || busy}
                    onClick={onStart}
                    style={{
                      width: '100%',
                      background: rolesValid && !busy ? '#fff' : 'rgba(255,255,255,0.22)',
                      color: rolesValid && !busy ? '#111827' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {busy ? 'Preparing…' : 'Start Debate →'}
                  </ReviewActionButton>
                )}
              </ReviewRailCard>

              <ReviewRailCard eyebrow="Debate Summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ReviewSummaryItem
                    label="Source"
                    value={arxivId ? `arXiv: ${arxivId}` : hasPendingFile ? 'PDF uploaded' : 'Not selected'}
                    tone={hasSource ? '#18181b' : '#b45309'}
                  />
                  <ReviewSummaryItem
                    label="Option A"
                    value={optionA || '—'}
                    tone={optionA ? '#4a6b73' : '#a1a1aa'}
                  />
                  <ReviewSummaryItem
                    label="Option B"
                    value={optionB || '—'}
                    tone={optionB ? '#7a4c54' : '#a1a1aa'}
                  />
                  <ReviewSummaryItem label="Domain" value={domainLabel} />
                  <ReviewSummaryItem
                    label="Roles selected"
                    value={selectedRoleIds.length > 0 ? `${selectedRoleIds.length} × 2 sides` : '—'}
                    tone={rolesValid ? '#18181b' : '#a1a1aa'}
                  />
                </div>
              </ReviewRailCard>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .debate-setup-grid {
              grid-template-columns: 1fr !important;
              gap: 14px !important;
            }
          }
        `}</style>
      </ReviewPageBody>
    </div>
  )
}
