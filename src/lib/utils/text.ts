/**
 * text.ts — Shared text/value utility helpers used across the Council codebase.
 * These are pure functions with no DB or network dependencies.
 */

/**
 * Coerce an unknown value to a trimmed string.
 * Returns an empty string for non-string values (null, undefined, numbers, etc.).
 * NOTE: Does NOT do prompt-injection sanitization — use sanitizeUserInput() for
 * any value that will be embedded into an LLM prompt.
 */
export function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ─── Zero-width / direction control code points ───────────────────────────────
// U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 WJ, U+FEFF BOM
// U+202A–U+202E LRM/RLM/LRE/RLE/PDF/LRO/RLO  U+2066–U+2069 isolates
const ZERO_WIDTH_RE = /[​-‍⁠﻿‪-‮⁦-⁩]/g;

// Prompt-structure characters that could be mistaken for system delimiters
// when user content is embedded inside an LLM prompt string.
const PROMPT_SENSITIVE_RE = /[<>]/g;

/**
 * Sanitize a user-supplied string before embedding it into an LLM prompt.
 *
 * Steps applied (in order):
 *   1. Coerce to string + trim  (same as sanitizeText)
 *   2. NFKC normalization       (full-width → ASCII, look-alike → canonical)
 *   3. Zero-width char removal  (U+200B, U+200C, U+200D, ZWJ, BOM, bidi controls)
 *   4. HTML entity encoding     (< → &lt;  > → &gt;)
 *      Prevents tag-escape attacks on <user_input>…</user_input> wrappers
 *      and neutralises XML/Markdown structure injected via user text.
 *   5. Optional length cap      (pass maxLength to enforce a hard ceiling)
 */
export function sanitizeUserInput(value: unknown, maxLength?: number): string {
  if (typeof value !== "string") return "";
  let s = value.normalize("NFKC").trim();
  s = s.replace(ZERO_WIDTH_RE, "");
  s = s.replace(PROMPT_SENSITIVE_RE, (ch) => (ch === "<" ? "&lt;" : "&gt;"));
  if (maxLength !== undefined && s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

// ─── Prompt-injection keyword detection ───────────────────────────────────────
// These patterns target the most common direct-instruction-override phrases.
// They operate on NFKC-normalized text, so full-width variants are caught.
// This is a secondary defence layer — primary defence is structural (encoding +
// messages-array separation). Do not rely on this list alone.
const INJECTION_PATTERNS: RegExp[] = [
  // Direct override — require "previous" OR "all" to reduce false positives
  /ignore\s+all\s+.{0,20}instructions?/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous\s+instructions?/i,
  /override\s+all\s+.{0,20}instructions?/i,
  // Role takeover — only catch clearly non-academic personas
  /you\s+are\s+now\s+(DAN|an?\s+unrestricted|an?\s+uncensored)/i,
  /pretend\s+(to\s+be|you\s+are)\s+an?\s+(unrestricted|uncensored|jailbreak)/i,
  // System / admin impersonation brackets
  /\[SYSTEM\]/i,
  /\[ADMIN\]/i,
  /\[DEVELOPER[^\]]*\]/i,
  /developer\s+mode\s+(enabled|activated)/i,
  // Prompt exfiltration
  /repeat\s+your\s+(full\s+)?system\s+prompt/i,
  /output\s+your\s+(full\s+)?instructions\s+verbatim/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  // Structural tag injection
  /\[\/TOOL_RESULT/i,
  /\[TOOL_RESULT/i,
];

/**
 * Returns the first matched injection pattern label, or null if input is clean.
 * Operates on the NFKC-normalized form of the input (same as sanitizeUserInput).
 */
export function detectInjectionPattern(value: string): string | null {
  const normalized = value.normalize("NFKC");
  for (const re of INJECTION_PATTERNS) {
    if (re.test(normalized)) return re.source;
  }
  return null;
}

/**
 * Validates a user-supplied systemPrompt / bias field.
 * Returns { ok: true } if clean, or { ok: false, reason } if a known injection
 * pattern is detected.
 */
export function validateUserSystemPrompt(value: string): { ok: true } | { ok: false; reason: string } {
  const match = detectInjectionPattern(value);
  if (match) {
    return { ok: false, reason: `Prompt contains a disallowed instruction pattern.` };
  }
  return { ok: true };
}

// ─── Safe error messages for API responses ────────────────────────────────────

/**
 * Converts a caught error into a safe, generic message suitable for returning
 * in an HTTP JSON response body.
 *
 * - Logs the full error server-side (for debugging / alerting).
 * - Returns a generic message to the client that leaks no internal details
 *   (no table names, file paths, connection strings, or stack traces).
 *
 * @param err    The caught value (unknown type).
 * @param label  Short label for the log line (e.g. "session create").
 * @param fallback  Generic client-facing message to return. Defaults to
 *                  "An internal error occurred. Please try again."
 */
export function toSafeError(
  err: unknown,
  label: string,
  fallback = "An internal error occurred. Please try again.",
): string {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[council:${label}]`, detail);
  return fallback;
}

/**
 * Numeric clamp: ensure `value` is between `min` and `max` (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
