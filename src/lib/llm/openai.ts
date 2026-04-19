const OPENAI_BASE = "https://api.openai.com/v1";

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY not configured");
  return k;
}

export function isOpenAIModel(model?: string): boolean {
  if (!model) return false;
  return (
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIUsage {
  inputTokens: number;
  outputTokens: number;
}

function buildMessages(
  prompt: string,
  systemPrompt?: string,
  history?: Array<{ role: string; content: string }>
): OpenAIMessage[] {
  const msgs: OpenAIMessage[] = [];
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
  if (history?.length) {
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        msgs.push({ role: m.role, content: m.content });
      }
    }
  } else {
    msgs.push({ role: "user", content: prompt });
  }
  return msgs;
}

export async function runOpenAI(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  onUsage?: (usage: OpenAIUsage) => void,
  maxTokens?: number,
): Promise<string> {
  const m = model || "gpt-4o";
  const messages = buildMessages(prompt, systemPrompt);
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ model: m, messages, max_tokens: maxTokens ?? 8192 }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (onUsage && data.usage) {
    onUsage({ inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 });
  }
  return data.choices?.[0]?.message?.content ?? "";
}

export async function* streamOpenAIText(
  messages: OpenAIMessage[],
  model?: string,
  onUsage?: (usage: OpenAIUsage) => void,
  maxTokens?: number,
): AsyncGenerator<string> {
  const m = model || "gpt-4o";
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: m,
      messages,
      max_tokens: maxTokens ?? 8192,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("OpenAI: no response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;
      try {
        const event = JSON.parse(json);
        if (onUsage && event.usage) {
          onUsage({ inputTokens: event.usage.prompt_tokens ?? 0, outputTokens: event.usage.completion_tokens ?? 0 });
        }
        const delta = event.choices?.[0]?.delta?.content as string | undefined;
        if (delta) yield delta;
      } catch { /* skip */ }
    }
  }
}
