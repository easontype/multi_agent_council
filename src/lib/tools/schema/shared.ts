// ── Agent Communication Protocol (ACP) ──────────────────────────────────────
// Agent-to-agent messages MUST use this pseudo-code format to minimize tokens

export const ORCHESTRATE_MAX_TURNS = 10;

export const ACP_PROTOCOL = `
## Agent Communication Protocol (ACP) — 強制規範
Agent 和 Agent 之間通訊一律使用以下偽代碼格式，嚴禁使用自然語言：

### 指派任務格式（Orchestrator → Worker）
TASK: <動作名稱>
CTX: <最小必要背景，逗號分隔>
IN: {key:val, ...}
OUT: <期望輸出格式，例如 {score:int, list:arr, text:str}>
LIMIT: <字數/token上限，例如 300tok>

### 回報結果格式（Worker → Orchestrator）
STATUS: ok|fail|partial
OUT: {key:val, ...}
NOTE: <僅在異常時填寫，一行>

### 範例
Orchestrator 發給 Worker：
TASK: seo_keywords
CTX: blog|zh-TW|2026
IN: {topic:"AI行銷", count:5}
OUT: {keywords:arr, difficulty:int}
LIMIT: 200tok

Worker 回覆：
STATUS: ok
OUT: {keywords:["AI自動化","行銷工具","SEO優化","內容生成","數位行銷"], difficulty:62}

### 語言規則
- Agent ↔ Agent：ACP 偽代碼（英文 key，數值 val）
- Orchestrator → 用戶：繁體中文，口語化，結構清晰
- 禁止在 ACP 訊息中加入說明文字或補充語句
### Council tools
- council_plan args: { topic, context?, goal?, preferredModel?, maxSeats? }
  Use this when a topic may need multi-agent debate. It returns recommended seats, rounds, template, and escalation signal.
- council_create args: { topic, title?, context?, goal?, rounds?, seats?, autoPlan?, autoRun? }
  Create a council session. Each seat may include { role, model, systemPrompt, bias?, tools?[] }.
  Omit seats or set autoPlan=true to auto-generate them.
- council_run args: { sessionId, resume?, forceRestart?, staleAfterMinutes? }
  Run, resume, or force-restart a council session.
- council_get args: { sessionId?, includeTurns?, includeConclusion? }
  Inspect a council session bundle, or list recent sessions when sessionId is omitted.
`.trim();

// ── Anthropic native tool schemas (for SDK-based tool calling) ────────────

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}
