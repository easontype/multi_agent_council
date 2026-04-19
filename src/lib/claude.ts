import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_GEMMA_MODEL } from "./gemma-models";
import { runOllama, streamOllamaText, type OllamaMessage } from "./ollama";
import { runGemini, streamGeminiText, isGeminiModel } from "./gemini";
import { runOpenAI, streamOpenAIText, isOpenAIModel, type OpenAIMessage } from "./openai";

const ANTHROPIC_VISION_FALLBACK_MODEL = "claude-3-5-sonnet-latest";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type NativeToolEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "done"; stopReason: string; usage: TokenUsage };

export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

export function isOllamaModel(model?: string): boolean {
  return !!model?.startsWith("ollama/");
}

export function isAnthropicModel(model?: string): boolean {
  if (!model) return false;
  return !isOllamaModel(model) && !isGeminiModel(model) && !isOpenAIModel(model);
}

function anthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return apiKey;
}

function resolveModel(model?: string): string {
  return model ?? DEFAULT_GEMMA_MODEL;
}

function toAnthropicMessages(
  prompt: string,
  messages?: Array<{ role: string; content: string }>,
): Anthropic.MessageParam[] {
  if (messages?.length) {
    return messages
      .filter((message): message is { role: "user" | "assistant"; content: string } =>
        message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }

  return [{ role: "user", content: prompt }];
}

function extractText(content: Anthropic.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function runAnthropic(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  maxTokens?: number,
): Promise<string> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const response = await client.messages.create({
    model: resolveModel(model),
    max_tokens: maxTokens ?? 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  return extractText(response.content);
}

async function* streamAnthropicText(
  prompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  messages?: Array<{ role: string; content: string }>,
  onUsage?: (usage: TokenUsage) => void,
  maxTokens?: number,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const stream = client.messages.stream({
    model: resolveModel(model),
    max_tokens: maxTokens ?? 8192,
    system: systemPrompt,
    messages: toAnthropicMessages(prompt, messages),
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    } else if (event.type === "message_delta" && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
  }

  onUsage?.({ inputTokens, outputTokens, costUsd: 0 });
}

export async function runLLM(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  maxTokens?: number,
): Promise<string> {
  const resolvedModel = resolveModel(model);
  if (isOllamaModel(resolvedModel)) return runOllama(prompt, systemPrompt, resolvedModel, maxTokens);
  if (isGeminiModel(resolvedModel)) return runGemini(prompt, systemPrompt, resolvedModel, undefined, maxTokens);
  if (isOpenAIModel(resolvedModel)) return runOpenAI(prompt, systemPrompt, resolvedModel, undefined, maxTokens);
  return runAnthropic(prompt, systemPrompt, resolvedModel, maxTokens);
}

export async function* streamLLM(
  prompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  messages?: OllamaMessage[],
  onUsage?: (usage: TokenUsage) => void,
  maxTokens?: number,
): AsyncGenerator<string> {
  const resolvedModel = resolveModel(model);

  if (isOllamaModel(resolvedModel)) {
    const ollamaMessages: OllamaMessage[] = messages ? [...messages] : [];
    if (!ollamaMessages.length) {
      if (systemPrompt) ollamaMessages.push({ role: "system", content: systemPrompt });
      ollamaMessages.push({ role: "user", content: prompt });
    }
    yield* streamOllamaText(ollamaMessages, resolvedModel, maxTokens);
    return;
  }

  if (isGeminiModel(resolvedModel)) {
    const history = messages
      ?.filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }));
    yield* streamGeminiText(prompt, systemPrompt, resolvedModel, history, maxTokens);
    return;
  }

  if (isOpenAIModel(resolvedModel)) {
    const openaiMessages: OpenAIMessage[] = (messages ?? []) as OpenAIMessage[];
    if (!openaiMessages.length) {
      if (systemPrompt) openaiMessages.push({ role: "system", content: systemPrompt });
      openaiMessages.push({ role: "user", content: prompt });
    }
    yield* streamOpenAIText(
      openaiMessages,
      resolvedModel,
      onUsage
        ? (usage) => onUsage({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: 0 })
        : undefined,
      maxTokens,
    );
    return;
  }

  yield* streamAnthropicText(prompt, systemPrompt, resolvedModel, messages, onUsage, maxTokens);
}

export async function* streamClaudeWithNativeTools(
  messages: Anthropic.MessageParam[],
  systemPrompt: string | undefined,
  model: string,
  tools: Anthropic.Tool[],
  maxTokens?: number,
): AsyncGenerator<NativeToolEvent> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const stream = client.messages.stream({
    model: resolveModel(model),
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

  for (const toolUse of toolUses) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(toolUse.inputJson || "{}");
    } catch {
      input = {};
    }
    yield { type: "tool_use", id: toolUse.id, name: toolUse.name, input };
  }

  yield {
    type: "done",
    stopReason,
    usage: { inputTokens, outputTokens, costUsd: 0 },
  };
}

export async function* streamClaudeWithVision(
  prompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  images: ImageAttachment[],
  history?: Array<{ role: string; content: string }>,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const resolvedModel = isAnthropicModel(model) ? model! : ANTHROPIC_VISION_FALLBACK_MODEL;
  const sdkMessages: Anthropic.MessageParam[] = [];

  if (history) {
    for (const message of history) {
      if (message.role === "user" || message.role === "assistant") {
        sdkMessages.push({ role: message.role, content: message.content });
      }
    }
  }

  const contentBlocks: Anthropic.ContentBlockParam[] = images.map((image) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: image.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: image.base64,
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
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

export { isOpenAIModel };
