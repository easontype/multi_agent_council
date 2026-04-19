// ── RAG / knowledge-base tool schemas ────────────────────────────────────────

import type { AnthropicTool } from "./shared";

export const RAG_TOOL_SCHEMAS: AnthropicTool[] = [
  {
    name: "ingest_transcripts",
    description: "同步讀取 hunter.db 中已轉錄的影片，匯入 PostgreSQL documents 表，供 RAG / 框架提取使用",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "最多匯入幾支（預設 20，最多 100）" },
      },
      required: [],
    },
  },
  {
    name: "ingest_pdf",
    description: "掃描 scripts/data-hunter/books/ 資料夾內的 PDF / EPUB，解析文字並匯入 documents 表，自動觸發向量嵌入。把電子書放進 books/ 資料夾後呼叫此工具即可。",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "最多處理幾本（預設 20，最多 50）" },
        file: { type: "string", description: "指定單一檔案的完整路徑（可選）" },
      },
      required: [],
    },
  },
  {
    name: "embed_documents",
    description: "把還沒有向量嵌入的 documents 切 chunk 並呼叫目前配置的 embedding provider，存入 document_chunks 表。第一次匯入後必須執行一次。",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "每次最多處理幾篇（預設 10，最多 50）" },
      },
      required: [],
    },
  },
  {
    name: "semantic_search",
    description: "對知識庫做語意搜尋（cosine similarity），回傳最相關的文本片段。需先執行 embed_documents 完成向量化。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜尋問題或關鍵字" },
        limit: { type: "number", description: "回傳幾段（預設 5，最多 20）" },
        tag: { type: "string", description: "過濾 tag（例如 youtube、transcript）" },
      },
      required: ["query"],
    },
  },
  {
    name: "rag_query",
    description: "完整 RAG 流程：先做語意搜尋，失敗時自動退到 keyword fallback；生成答案優先用本地或指定模型，必要時再退回 extractive digest，不讓整條流程因單一供應商 quota 中斷。",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "要問知識庫的問題" },
        limit: { type: "number", description: "參考幾段（預設 5）" },
        tag: { type: "string", description: "過濾 tag（例如 youtube）" },
      },
      required: ["question"],
    },
  },
];
