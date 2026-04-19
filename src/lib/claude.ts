import { spawn } from "child_process";
import { runOllama, streamOllamaText, type OllamaMessage } from "./ollama";
import { runGemini, streamGeminiText, isGeminiModel } from "./gemini";
import { runOpenAI, streamOpenAIText, isOpenAIModel, type OpenAIMessage } from "./openai";
import { runCodex, streamCodexText, isCodexModel } from "./codex";
import Anthropic from "@anthropic-ai/sdk";

/** Returns true if the model should be routed to local Ollama */
export function isOllamaModel(model?: string): boolean {
  return !!model?.startsWith("ollama/");
}

/**
 * Unified non-streaming completion — routes to Claude CLI, Ollama, Gemini, or OpenAI.
 */
export async function runLLM(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  if (isOllamaModel(model)) return runOllama(prompt, systemPrompt, model);
  if (isGeminiModel(model)) return runGemini(prompt, systemPrompt, model);
  if (isOpenAIModel(model)) return runOpenAI(prompt, systemPrompt, model);
  if (isCodexModel(model)) return runCodex(prompt, systemPrompt, model);
  return runClaude(prompt, systemPrompt, model);
}

/**
 * Unified streaming — routes to Claude CLI, Ollama, Gemini, or OpenAI.
 * For Ollama/Gemini/OpenAI, accepts a full messages array for proper multi-turn context.
 */
export async function* streamLLM(
  prompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  messages?: OllamaMessage[],
  onUsage?: (usage: TokenUsage) => void
): AsyncGenerator<string> {
  if (isOllamaModel(model)) {
    const msgs: OllamaMessage[] = messages ?? [];
    if (!msgs.length) {
      if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
      msgs.push({ role: "user", content: prompt });
    }
    yield* streamOllamaText(msgs, model);
  } else if (isGeminiModel(model)) {
    const history = messages
      ?.filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    yield* streamGeminiText(prompt, systemPrompt, model, history);
  } else if (isOpenAIModel(model)) {
    const openaiMsgs: OpenAIMessage[] = (messages ?? []) as OpenAIMessage[];
    if (!openaiMsgs.length) {
      if (systemPrompt) openaiMsgs.push({ role: "system", content: systemPrompt });
      openaiMsgs.push({ role: "user", content: prompt });
    }
    yield* streamOpenAIText(openaiMsgs, model, onUsage
      ? (u) => onUsage({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, costUsd: 0 })
      : undefined
    );
  } else if (isCodexModel(model)) {
    yield* streamCodexText(prompt, systemPrompt, model, onUsage
      ? (u) => onUsage({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, costUsd: 0 })
      : undefined
    );
  } else {
    yield* streamClaudeText(prompt, systemPrompt, model, onUsage);
  }
}

// Re-exports for chat route model detection
export { isOpenAIModel, isCodexModel };

// claude CLI — Windows 用 claude.exe（安裝在 .local/bin），Unix 用 claude
const CLAUDE_CMD = "claude";

/** Build env for claude CLI subprocess:
 *  - Remove CLAUDECODE to allow nested sessions
 *  - Remove ANTHROPIC_API_KEY so CLI uses subscription token, not a (possibly invalid) API key
 */
function buildEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.ANTHROPIC_API_KEY;
  return env;
}

/** Spawn the claude CLI and return the child process + a promise that resolves with the exit code */
function spawnClaude(args: string[], input: string) {
  const proc = spawn(CLAUDE_CMD, args.filter(a => a !== ""), {
    env: buildEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });

  proc.stdin.write(input, "utf8");
  proc.stdin.end();

  const done = new Promise<number>((resolve) =>
    proc.on("close", (code) => resolve(code ?? 0))
  );

  return { proc, done };
}

/**
 * Run a single-turn Claude completion (non-streaming).
 * Uses the local claude CLI — no API key required, uses subscription token.
 */
export async function runClaude(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  const args = [
    "--print",
    "--output-format", "json",
    "--no-session-persistence",
    "--tools", "",          // disable built-in tools — faster startup, no tool tokens
  ];
  if (model) args.push("--model", model);
  const stdin = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;

  const { proc, done } = spawnClaude(args, stdin);

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
  proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  const code = await done;
  if (code !== 0) {
    throw new Error(`Claude CLI exited ${code}: ${stderr || stdout}`);
  }

  try {
    const json = JSON.parse(stdout);
    return (json.result as string) ?? "";
  } catch {
    return stdout.trim();
  }
}

/**
 * Run Claude with session persistence — supports cross-turn memory via --resume.
 * Returns both the text result and the session ID (for saving and resuming next call).
 * Used by the CTO heartbeat tool loop to maintain context across turns AND heartbeats.
 */
export async function runClaudeWithSession(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  resumeSessionId?: string | null,
): Promise<{ result: string; sessionId: string | null }> {
  const args = ["--print", "--output-format", "json", "--tools", ""];
  if (model) args.push("--model", model);
  if (resumeSessionId) {
    // Resume existing session — history lives in the session, no need to repeat it
    args.push("--resume", resumeSessionId);
  }
  // When resuming, only pass the new prompt (not the system prompt — it's in the session)
  const stdin = (!resumeSessionId && systemPrompt)
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  async function attempt(attemptArgs: string[], attemptStdin: string) {
    const { proc, done } = spawnClaude(attemptArgs, attemptStdin);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    const code = await done;
    return { code, stdout, stderr };
  }

  let { code, stdout, stderr } = await attempt(args, stdin);

  // Session expired / not found → retry as fresh session
  if (code !== 0 && (stderr + stdout).includes("No conversation found")) {
    console.warn(`[claude] session ${resumeSessionId} expired, starting fresh`);
    const freshArgs = ["--print", "--output-format", "json", "--tools", ""];
    if (model) freshArgs.push("--model", model);
    const freshStdin = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
    ({ code, stdout, stderr } = await attempt(freshArgs, freshStdin));
  }

  if (code !== 0) {
    throw new Error(`Claude CLI exited ${code}: ${stderr || stdout}`);
  }

  try {
    const json = JSON.parse(stdout);
    const result = (json.result as string) ?? "";
    const sessionId = (json.session_id as string) ?? null;
    return { result, sessionId };
  } catch {
    return { result: stdout.trim(), sessionId: null };
  }
}

/**
 * Stream Claude response text chunks.
 * Yields raw text deltas as they arrive from the claude CLI.
 * Uses the local claude CLI — no API key required, uses subscription token.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function* streamClaudeText(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  onUsage?: (usage: TokenUsage) => void
): AsyncGenerator<string> {
  const args = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--no-session-persistence",
    "--tools", "",          // disable built-in tools — faster startup, no tool tokens
  ];
  if (model) args.push("--model", model);
  // Embed system prompt in stdin to avoid Windows shell arg length/escaping issues
  const stdin = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;

  const proc = spawn(CLAUDE_CMD, args, {
    env: buildEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });

  proc.stdin.write(stdin, "utf8");
  proc.stdin.end();

  let buffer = "";
  let stderr = "";
  let resultError: string | null = null;

  proc.stderr.on("data", (d: Buffer) => {
    stderr += d.toString("utf8");
  });

  function processEvent(trimmed: string): string | null {
    try {
      const event = JSON.parse(trimmed);
      // Text delta — yield to caller
      if (
        event.type === "stream_event" &&
        event.event?.delta?.type === "text_delta" &&
        typeof event.event.delta.text === "string"
      ) {
        return event.event.delta.text as string;
      }
      // Final result event — extract token usage
      if (event.type === "result" && onUsage) {
        const usage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        onUsage({
          inputTokens: usage?.input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
          costUsd: typeof event.cost_usd === "number" ? event.cost_usd : 0,
        });
      }
      if (event.type === "result" && event.is_error) {
        resultError = typeof event.result === "string" ? event.result : "Claude CLI returned an error result";
      }
    } catch {
      // skip non-JSON lines
    }
    return null;
  }

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const text = processEvent(trimmed);
      if (text !== null) yield text;
    }
  }

  // Drain remaining buffer
  if (buffer.trim()) {
    const text = processEvent(buffer.trim());
    if (text !== null) yield text;
  }

  const exitCode = await new Promise<number>((resolve) => proc.on("close", (code) => resolve(code ?? 0)));
  if (exitCode !== 0 || resultError) {
    throw new Error(`Claude CLI exited ${exitCode}: ${resultError || stderr || "unknown error"}`);
  }
}

/**
 * Format a conversation history array into a plain-text transcript
 * suitable for passing to `claude --print` as a single prompt.
 */
export function buildConversationPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .map((m) => `${m.role === "user" ? "用戶" : "助理"}: ${m.content}`)
    .join("\n\n");
}

// ── Native tool calling via Anthropic SDK ─────────────────────────────────

export type NativeToolEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "done"; stopReason: string; usage: TokenUsage };

/**
 * Stream a Claude response with native tool calling (Anthropic SDK).
 * One round only — caller is responsible for the multi-round loop.
 * Requires ANTHROPIC_API_KEY env var.
 */
export async function* streamClaudeWithNativeTools(
  messages: Anthropic.MessageParam[],
  systemPrompt: string | undefined,
  model: string,
  tools: Anthropic.Tool[],
  maxTokens?: number,
): AsyncGenerator<NativeToolEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield { type: "done", stopReason: "error", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
    return;
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens ?? 8192,
    system: systemPrompt,
    tools,
    messages,
  });

  let inToolUse = false;
  const toolUses: Array<{ id: string; name: string; inputJson: string }> = [];
  let stopReason = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    } else if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        inToolUse = true;
        toolUses.push({ id: event.content_block.id, name: event.content_block.name, inputJson: "" });
      } else {
        inToolUse = false;
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      } else if (event.delta.type === "input_json_delta" && inToolUse) {
        toolUses[toolUses.length - 1].inputJson += event.delta.partial_json;
      }
    } else if (event.type === "content_block_stop") {
      inToolUse = false;
    } else if (event.type === "message_delta") {
      if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
      if (event.usage) outputTokens = event.usage.output_tokens;
    }
  }

  // Yield collected tool uses after text streaming is done
  for (const tu of toolUses) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tu.inputJson || "{}"); } catch { /* keep empty */ }
    yield { type: "tool_use", id: tu.id, name: tu.name, input };
  }

  yield { type: "done", stopReason, usage: { inputTokens, outputTokens, costUsd: 0 } };
}

/**
 * Non-streaming single-round Claude call with tool support (Anthropic SDK).
 * Returns { text, toolUses } — caller handles the multi-round loop.
 */
export async function callClaudeWithTools(
  messages: Anthropic.MessageParam[],
  systemPrompt: string | undefined,
  model: string,
  tools: Anthropic.Tool[],
): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>; stopReason: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 未設定，無法使用工具模式");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    tools,
    messages,
  });

  let text = "";
  const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolUses.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
    }
  }
  return {
    text, toolUses,
    stopReason: response.stop_reason ?? "end_turn",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export interface ImageAttachment {
  base64: string;
  mimeType: string; // "image/jpeg" | "image/png" | "image/gif" | "image/webp"
}

/**
 * Stream a Claude response with vision support via Anthropic SDK.
 * Used when the user attaches images to the chat — the Claude CLI doesn't support images,
 * so we call the API directly.
 */
export async function* streamClaudeWithVision(
  prompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  images: ImageAttachment[],
  history?: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield "⚠️ 視覺功能需要 ANTHROPIC_API_KEY 環境變數，請在 .env 中設定後重新啟動伺服器。";
    return;
  }

  const client = new Anthropic({ apiKey });
  const resolvedModel = model ?? "claude-sonnet-4-6";

  // Build message history
  const sdkMessages: Anthropic.MessageParam[] = [];
  if (history) {
    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        sdkMessages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // Build the last user message with image content blocks
  const contentBlocks: Anthropic.ContentBlockParam[] = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: img.base64,
    },
  }));
  contentBlocks.push({ type: "text", text: prompt });

  sdkMessages.push({ role: "user", content: contentBlocks });

  const stream = client.messages.stream({
    model: resolvedModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: sdkMessages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}
