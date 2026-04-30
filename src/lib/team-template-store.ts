import type { EditableReviewAgent, ReviewMode } from "./prompts/review-presets";

export interface SavedTeamTemplate {
  id: string;
  name: string;
  mode: ReviewMode;
  rounds: 1 | 2;
  agents: EditableReviewAgent[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "council.saved-team-templates.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSavedTeamTemplate(item: unknown): item is SavedTeamTemplate {
  if (!item || typeof item !== "object") return false;
  const value = item as Record<string, unknown>;
  return Boolean(
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.mode === "critique" || value.mode === "gap") &&
    (value.rounds === 1 || value.rounds === 2) &&
    Array.isArray(value.agents) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string",
  );
}

function readLocalTemplates(): SavedTeamTemplate[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedTeamTemplate).slice(0, 20);
  } catch {
    return [];
  }
}

function writeLocalTemplates(templates: SavedTeamTemplate[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 20)));
}

function normalizeServerTemplates(payload: unknown): SavedTeamTemplate[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const candidate: SavedTeamTemplate = {
        id: typeof value.id === "string" ? value.id : "",
        name: typeof value.name === "string" ? value.name : "",
        mode: value.mode === "gap" ? "gap" : "critique",
        rounds: value.rounds === 2 ? 2 : 1,
        agents: Array.isArray(value.agents) ? (value.agents as EditableReviewAgent[]) : [],
        createdAt: typeof value.createdAt === "string"
          ? value.createdAt
          : typeof value.created_at === "string"
            ? value.created_at
            : new Date().toISOString(),
        updatedAt: typeof value.updatedAt === "string"
          ? value.updatedAt
          : typeof value.updated_at === "string"
            ? value.updated_at
            : new Date().toISOString(),
      };
      return isSavedTeamTemplate(candidate) ? candidate : null;
    })
    .filter((item): item is SavedTeamTemplate => Boolean(item))
    .slice(0, 20);
}

async function tryLoadServerTemplates(): Promise<SavedTeamTemplate[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/team-templates", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const templates = normalizeServerTemplates(data);
    writeLocalTemplates(templates);
    return templates;
  } catch {
    return null;
  }
}

async function trySaveServerTemplate(template: SavedTeamTemplate): Promise<SavedTeamTemplate[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/team-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(template),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const templates = normalizeServerTemplates(data.templates);
    writeLocalTemplates(templates);
    return templates;
  } catch {
    return null;
  }
}

async function tryDeleteServerTemplate(id: string): Promise<SavedTeamTemplate[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch(`/api/team-templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const templates = normalizeServerTemplates(data.templates);
    writeLocalTemplates(templates);
    return templates;
  } catch {
    return null;
  }
}

function upsertLocalTemplate(template: SavedTeamTemplate): SavedTeamTemplate[] {
  const existing = readLocalTemplates();
  const next = [template, ...existing.filter((item) => item.id !== template.id)]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20);
  writeLocalTemplates(next);
  return next;
}

function deleteLocalTemplate(id: string): SavedTeamTemplate[] {
  const next = readLocalTemplates().filter((item) => item.id !== id);
  writeLocalTemplates(next);
  return next;
}

export async function loadSavedTeamTemplates(): Promise<SavedTeamTemplate[]> {
  return (await tryLoadServerTemplates()) ?? readLocalTemplates();
}

export async function upsertSavedTeamTemplate(template: SavedTeamTemplate): Promise<SavedTeamTemplate[]> {
  return (await trySaveServerTemplate(template)) ?? upsertLocalTemplate(template);
}

export async function deleteSavedTeamTemplate(id: string): Promise<SavedTeamTemplate[]> {
  return (await tryDeleteServerTemplate(id)) ?? deleteLocalTemplate(id);
}
