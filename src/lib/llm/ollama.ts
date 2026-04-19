const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Strip the "ollama/" prefix to get the actual model name */
export function ollamaModelName(model: string): string {
  return model.startsWith("ollama/") ? model.slice(7) : model;
}

/** Non-streaming completion via Ollama */
export async function runOllama(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  maxTokens?: number,
): Promise<string> {
  const messages: OllamaMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModelName(model || "llama3"),
      messages,
      stream: false,
      options: typeof maxTokens === "number" ? { num_predict: maxTokens } : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.message?.content as string) ?? "";
}

/** Streaming completion via Ollama — yields text chunks */
export async function* streamOllamaText(
  messages: OllamaMessage[],
  model?: string,
  maxTokens?: number,
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModelName(model || "llama3"),
      messages,
      stream: true,
      options: typeof maxTokens === "number" ? { num_predict: maxTokens } : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  if (!res.body) throw new Error("Ollama: no response body");

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
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const text = event.message?.content as string | undefined;
        if (text) yield text;
        if (event.done) return;
      } catch {
        // skip
      }
    }
  }
}
