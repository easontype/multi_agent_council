// ── Web search / URL fetch tool schemas ──────────────────────────────────────

import type { AnthropicTool } from "./shared";

export const WEB_TOOL_SCHEMAS: AnthropicTool[] = [
  {
    name: "web_search",
    description: "搜尋網路上的最新資訊、新聞、知識",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜尋關鍵字或問題" },
        count: { type: "number", description: "回傳結果數量（預設 5，最多 10）" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description: "抓取網頁內容（HTML 轉純文字），用於爬文、讀取文章、取得資料",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "要抓取的網頁 URL" },
        selector: { type: "string", description: "CSS selector，只擷取特定區塊（可選，例如 'article' 或 'main'）" },
      },
      required: ["url"],
    },
  },
];
