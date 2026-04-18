import type { EditableReviewAgent, ReviewMode } from './review-presets'

export interface SavedTeamTemplate {
  id: string
  name: string
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'council.saved-team-templates.v1'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadSavedTeamTemplates(): SavedTeamTemplate[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is SavedTeamTemplate => Boolean(
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.mode === 'critique' || item.mode === 'gap') &&
        (item.rounds === 1 || item.rounds === 2) &&
        Array.isArray(item.agents),
      ))
      .slice(0, 20)
  } catch {
    return []
  }
}

export function saveSavedTeamTemplates(templates: SavedTeamTemplate[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 20)))
}

export function upsertSavedTeamTemplate(template: SavedTeamTemplate) {
  const existing = loadSavedTeamTemplates()
  const next = [template, ...existing.filter((item) => item.id !== template.id)]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20)
  saveSavedTeamTemplates(next)
  return next
}

export function deleteSavedTeamTemplate(id: string) {
  const next = loadSavedTeamTemplates().filter((item) => item.id !== id)
  saveSavedTeamTemplates(next)
  return next
}
