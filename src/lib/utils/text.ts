/**
 * text.ts — Shared text/value utility helpers used across the Council codebase.
 * These are pure functions with no DB or network dependencies.
 */

/**
 * Coerce an unknown value to a trimmed string.
 * Returns an empty string for non-string values (null, undefined, numbers, etc.).
 */
export function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Numeric clamp: ensure `value` is between `min` and `max` (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
