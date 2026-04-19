const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function apiKey() {
  const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not configured");
  return k;
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
  onUsage?: (usage: GeminiUsage) => void
): Promise<string> {
  const m = model || "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/models/${m}:generateContent?key=${apiKey()}`;
  const body = buildContents(prompt, systemPrompt);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: 8192 } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

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
  history?: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const m = model || "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/models/${m}:streamGenerateContent?alt=sse&key=${apiKey()}`;
  const body = buildContents(prompt, systemPrompt, history);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: 8192 } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

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
