const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MAX_ATTEMPTS = 4;
const GEMINI_BASE_BACKOFF_MS = 1_000;

function apiKey() {
  const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not configured");
  return k;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 503;
}

async function fetchGeminiWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;

      const errText = await res.text();
      const error = new Error(`Gemini error ${res.status}: ${errText}`);
      if (!isRetryableGeminiStatus(res.status) || attempt === GEMINI_MAX_ATTEMPTS) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const retryable = /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|quota/i.test(normalized.message);
      if (!retryable || attempt === GEMINI_MAX_ATTEMPTS) {
        throw normalized;
      }
      lastError = normalized;
    }

    await sleep(GEMINI_BASE_BACKOFF_MS * 2 ** (attempt - 1));
  }

  throw lastError ?? new Error("Gemini request failed");
}

export function isGeminiModel(model?: string): boolean {
  return !!model?.startsWith("gemini") || !!model?.startsWith("gemma");
}

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

function buildContents(
  prompt: string,
  systemPrompt?: string,
  history?: Array<{ role: string; content: string }>
): { systemInstruction?: { parts: Array<{ text: string }> }; contents: GeminiContent[] } {
  const contents: GeminiContent[] = [];

  if (history?.length) {
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
      }
    }
  } else {
    contents.push({ role: "user", parts: [{ text: prompt }] });
  }

  return {
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents,
  };
}

export interface GeminiUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Non-streaming completion via Gemini */
export async function runGemini(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  onUsage?: (usage: GeminiUsage) => void,
  maxTokens?: number,
): Promise<string> {
  const m = model || "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/models/${m}:generateContent?key=${apiKey()}`;
  const body = buildContents(prompt, systemPrompt);

  const res = await fetchGeminiWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: maxTokens ?? 8192 } }),
  });

  const data = await res.json();
  if (onUsage && data.usageMetadata) {
    onUsage({
      inputTokens: data.usageMetadata.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
    });
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Streaming completion via Gemini — yields text chunks */
export async function* streamGeminiText(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  history?: Array<{ role: string; content: string }>,
  maxTokens?: number,
): AsyncGenerator<string> {
  const m = model || "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/models/${m}:streamGenerateContent?alt=sse&key=${apiKey()}`;
  const body = buildContents(prompt, systemPrompt, history);

  const res = await fetchGeminiWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: maxTokens ?? 8192 } }),
  });

  if (!res.body) throw new Error("Gemini: no response body");

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
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}
