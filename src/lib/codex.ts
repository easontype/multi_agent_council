/**
 * Codex CLI subprocess routing — 5-account rotation with quota circuit-breaker
 *
 * Model routing: any model starting with "codex/" is routed here.
 *   "codex/codex"    → uses per-account config.toml default (currently gpt-5.4 + reasoning_effort=high)
 *   "codex/gpt-5.4"  → codex exec -m gpt-5.4  (explicit, same as account default; RECOMMENDED)
 *   "codex/o3"       → codex exec -m o3
 *   "codex/gpt-4.5"  → codex exec -m gpt-4.5
 *
 * Reasoning effort: each account's config.toml already sets model_reasoning_effort = "high".
 * When using "codex/codex" (no -m flag), the account config is inherited automatically.
 * When specifying an explicit model, you can append ":high"/":medium"/":low" to the model string
 * to set reasoning_effort via -c, e.g. "codex/gpt-5.4:high".
 *
 * Account isolation: CODEX_HOME env var points to one of five
 * per-account directories (~/.codex-a through ~/.codex-e).
 *
 * Quota circuit-breaker:
 *   - On 429 / quota_exceeded error, account is disabled for QUOTA_COOLDOWN_MS
 *   - pickAccount() skips disabled accounts automatically
 *   - runCodex / streamCodexText retry up to MAX_RETRIES times on quota errors
 *   - Accounts missing cap_sid (incomplete login) are also skipped
 *
 * Note: Codex CLI --json outputs completed items, not per-character
 * deltas, so "streaming" yields each item.completed text as it arrives.
 */

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// ── Constants ──────────────────────────────────────────────────────────────

/** How long to back off a quota-exhausted account before retrying (ms) */
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/** Max accounts to try per request before giving up */
const MAX_RETRIES = 5;

// ── Account pool ───────────────────────────────────────────────────────────

const CODEX_ACCOUNTS = ["a", "b", "c", "d", "e"].map((letter) =>
  path.join(os.homedir(), `.codex-${letter}`)
);

interface AccountState {
  lastUsed: number;       // epoch ms of last request
  requestCount: number;
  errorCount: number;
  disabledUntil: number;  // epoch ms; 0 = not disabled
  lastError: string;
}

const _accountState = new Map<string, AccountState>();

function getState(home: string): AccountState {
  if (!_accountState.has(home)) {
    _accountState.set(home, {
      lastUsed: 0,
      requestCount: 0,
      errorCount: 0,
      disabledUntil: 0,
      lastError: "",
    });
  }
  return _accountState.get(home)!;
}

/** Check whether an account has a valid login (both auth.json and cap_sid) */
function hasValidLogin(home: string): boolean {
  return (
    fs.existsSync(path.join(home, "auth.json")) ||
    fs.existsSync(path.join(home, "cap_sid"))
  );
}

/** Mark an account as quota-exhausted for QUOTA_COOLDOWN_MS */
function disableAccount(home: string, reason: string): void {
  const s = getState(home);
  s.disabledUntil = Date.now() + QUOTA_COOLDOWN_MS;
  s.lastError = reason;
  s.errorCount++;
  console.warn(`[codex] account ${path.basename(home)} disabled for ${QUOTA_COOLDOWN_MS / 60000} min — ${reason}`);
}

/** Round-robin index, shared across calls */
let _rrIndex = 0;

/**
 * Pick the next available account.
 * Skips: accounts missing cap_sid, accounts in quota cooldown.
 * Returns null if all accounts are unavailable.
 */
function pickAccount(): string {
  const now = Date.now();
  const total = CODEX_ACCOUNTS.length;

  for (let attempt = 0; attempt < total; attempt++) {
    const home = CODEX_ACCOUNTS[_rrIndex % total];
    _rrIndex++;

    if (!hasValidLogin(home)) continue;

    const s = getState(home);
    if (s.disabledUntil > now) continue;

    // Valid account — record usage
    s.lastUsed = now;
    s.requestCount++;
    return home;
  }

  // All accounts exhausted — find the one whose cooldown expires soonest
  const soonest = CODEX_ACCOUNTS.filter(hasValidLogin).sort(
    (a, b) => getState(a).disabledUntil - getState(b).disabledUntil
  )[0];

  if (soonest) {
    const remaining = Math.ceil((getState(soonest).disabledUntil - now) / 60000);
    throw new Error(
      `[codex] all accounts are quota-limited. Next available in ~${remaining} min (${path.basename(soonest)})`
    );
  }

  throw new Error("[codex] no Codex accounts with valid login found");
}

// ── Model detection ────────────────────────────────────────────────────────

/** Returns true for models routed via Codex CLI (prefix "codex/") */
export function isCodexModel(model?: string): boolean {
  return !!model?.startsWith("codex/");
}

/** Strip "codex/" prefix → raw model name, e.g. "codex/o3" → "o3" */
function rawModel(model: string): string {
  return model.slice("codex/".length);
}

// ── Quota error detection ──────────────────────────────────────────────────

const QUOTA_PATTERNS = [
  /429/,
  /quota/i,
  /rate.?limit/i,
  /insufficient_quota/i,
  /exceeded.*quota/i,
  /too many requests/i,
  /billing/i,
];

function isQuotaError(msg: string): boolean {
  return QUOTA_PATTERNS.some((re) => re.test(msg));
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CodexUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

interface CodexEvent {
  type: string;
  item?: { id: string; type: string; text?: string };
  usage?: { input_tokens: number; cached_input_tokens?: number; output_tokens: number };
  error?: { message: string };
  message?: string;
}

function parseEvent(line: string): CodexEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as CodexEvent;
  } catch {
    return null;
  }
}

// ── Subprocess ─────────────────────────────────────────────────────────────

function buildCodexEnv(codexHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  env.CODEX_HOME = codexHome;
  delete env.CLAUDECODE;
  return env;
}

function buildCodexArgs(model: string): string[] {
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
  ];
  const raw = rawModel(model);
  // Support "model:reasoning_effort" syntax, e.g. "gpt-5.4:high"
  const colonIdx = raw.lastIndexOf(":");
  const hasEffortSuffix = colonIdx !== -1 &&
    ["high", "medium", "low"].includes(raw.slice(colonIdx + 1));
  const modelName = hasEffortSuffix ? raw.slice(0, colonIdx) : raw;
  const reasoningEffort = hasEffortSuffix ? raw.slice(colonIdx + 1) : null;

  if (modelName && modelName !== "codex") args.push("-m", modelName);
  if (reasoningEffort) args.push("-c", `model_reasoning_effort="${reasoningEffort}"`);
  // Read prompt from stdin
  args.push("-");
  return args;
}

function spawnCodex(prompt: string, model: string, codexHome: string) {
  const args = buildCodexArgs(model);
  const proc = spawn("codex", args, {
    env: buildCodexEnv(codexHome),
    cwd: "D:\\",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });
  proc.stdin.write(prompt, "utf8");
  proc.stdin.end();
  const done = new Promise<number>((resolve) =>
    proc.on("close", (code) => resolve(code ?? 0))
  );
  return { proc, done };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Non-streaming Codex completion with quota-aware auto-retry.
 */
export async function runCodex(
  prompt: string,
  systemPrompt?: string,
  model = "codex/codex",
  onUsage?: (usage: CodexUsage) => void
): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
  let lastErr = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const codexHome = pickAccount(); // throws if none available

    const { proc, done } = spawnCodex(fullPrompt, model, codexHome);

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const code = await done;

    // Parse all events first so we can detect quota errors
    const textParts: string[] = [];
    let quotaError = "";
    let otherError = "";

    for (const line of stdout.split("\n")) {
      const event = parseEvent(line);
      if (!event) continue;

      if (event.type === "item.completed" &&
          event.item?.type === "agent_message" &&
          typeof event.item.text === "string") {
        textParts.push(event.item.text);
      } else if (event.type === "turn.completed" && onUsage && event.usage) {
        onUsage({
          inputTokens: event.usage.input_tokens ?? 0,
          cachedInputTokens: event.usage.cached_input_tokens ?? 0,
          outputTokens: event.usage.output_tokens ?? 0,
        });
      } else if (event.type === "error") {
        const msg = event.error?.message ?? event.message ?? "unknown error";
        if (isQuotaError(msg)) quotaError = msg;
        else otherError = msg;
      }
    }

    // Non-zero exit with quota signal
    const combined = stderr + stdout + quotaError;
    if (isQuotaError(combined) || quotaError) {
      const reason = quotaError || combined.slice(0, 200);
      disableAccount(codexHome, reason);
      lastErr = reason;
      console.warn(`[codex] quota hit on ${path.basename(codexHome)}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
      continue;
    }

    if (code !== 0 || otherError) {
      throw new Error(`Codex error (${path.basename(codexHome)}): ${otherError || stderr || stdout}`);
    }

    return textParts.join("\n");
  }

  throw new Error(`[codex] all retries exhausted after quota errors. Last: ${lastErr}`);
}

/**
 * Streaming Codex completion with quota-aware auto-retry.
 * Codex CLI delivers completed items — text appears all at once per item.
 */
export async function* streamCodexText(
  prompt: string,
  systemPrompt?: string,
  model = "codex/codex",
  onUsage?: (usage: CodexUsage) => void
): AsyncGenerator<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const codexHome = pickAccount();

    const { proc } = spawnCodex(fullPrompt, model, codexHome);

    let buffer = "";
    let quotaError = "";
    let otherError = "";
    const textParts: string[] = [];

    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseEvent(line);
        if (!event) continue;

        if (event.type === "item.completed" &&
            event.item?.type === "agent_message" &&
            typeof event.item.text === "string") {
          // Yield immediately for live UI — but buffer for potential retry detection
          textParts.push(event.item.text);
        } else if (event.type === "turn.completed" && onUsage && event.usage) {
          onUsage({
            inputTokens: event.usage.input_tokens ?? 0,
            cachedInputTokens: event.usage.cached_input_tokens ?? 0,
            outputTokens: event.usage.output_tokens ?? 0,
          });
        } else if (event.type === "error") {
          const msg = event.error?.message ?? event.message ?? "unknown Codex error";
          if (isQuotaError(msg)) quotaError = msg;
          else otherError = msg;
        }
      }
    }

    // Drain remaining buffer
    if (buffer.trim()) {
      const event = parseEvent(buffer);
      if (event?.type === "item.completed" &&
          event.item?.type === "agent_message" &&
          typeof event.item.text === "string") {
        textParts.push(event.item.text);
      }
    }

    await new Promise<void>((resolve) => proc.on("close", () => resolve()));

    // Quota error → disable this account, retry with next
    if (quotaError) {
      disableAccount(codexHome, quotaError);
      console.warn(`[codex] quota hit on ${path.basename(codexHome)}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
      continue;
    }

    if (otherError) throw new Error(`Codex error (${path.basename(codexHome)}): ${otherError}`);

    // Success — yield all collected text parts
    for (const text of textParts) yield text;
    return;
  }

  throw new Error("[codex] all retries exhausted after quota errors");
}

// ── Monitoring ─────────────────────────────────────────────────────────────

/** Return per-account state for monitoring/debugging */
export function getCodexAccountStats(): Array<{
  slot: string;
  home: string;
  loggedIn: boolean;
  available: boolean;
  requestCount: number;
  errorCount: number;
  lastUsed: number;
  disabledUntil: number;
  lastError: string;
}> {
  const now = Date.now();
  return CODEX_ACCOUNTS.map((home) => {
    const s = getState(home);
    const loggedIn = hasValidLogin(home);
    return {
      slot: path.basename(home),
      home,
      loggedIn,
      available: loggedIn && s.disabledUntil <= now,
      requestCount: s.requestCount,
      errorCount: s.errorCount,
      lastUsed: s.lastUsed,
      disabledUntil: s.disabledUntil,
      lastError: s.lastError,
    };
  });
}
