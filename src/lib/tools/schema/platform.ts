// ── Platform / agent management tool schemas ─────────────────────────────────
// Covers: self-management, agent mgmt, tasks, orchestration, council,
//         content pipeline, ecommerce, social media, documents, review flow.

import type { AnthropicTool } from "./shared";
import { ORCHESTRATE_MAX_TURNS } from "./shared";

export const PLATFORM_TOOL_SCHEMAS: AnthropicTool[] = [
  {
    name: "list_tools",
    description: "列出平台上所有可用的 tools（內建工具和用戶建立的 HTTP/MCP tools）",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_tool",
    description: "建立新的工具並自動指派給自己。type=http 適合呼叫外部 REST API，config 需包含 url 等設定",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "工具名稱（英文，無空格）" },
        type: { type: "string", enum: ["http", "code", "browser", "database", "storage", "scheduler", "mcp", "other"] },
        description: { type: "string", description: "工具描述" },
        config: { type: "object", description: "工具設定（http 工具需包含 url、authType、authValue 等）" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "assign_tool",
    description: "將平台上已存在的 tool 指派給自己",
    input_schema: {
      type: "object",
      properties: { toolId: { type: "string", description: "tool UUID（先用 list_tools 查詢）" } },
      required: ["toolId"],
    },
  },
  {
    name: "remove_tool",
    description: "從自己身上移除某個 tool",
    input_schema: {
      type: "object",
      properties: { toolId: { type: "string", description: "tool UUID" } },
      required: ["toolId"],
    },
  },
  {
    name: "list_skills",
    description: "列出平台上所有 skills（SOP、領域知識、規則文件）",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_skill",
    description: "建立新的 skill（SOP、規則、領域知識）並自動指派給自己",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "技能名稱" },
        description: { type: "string", description: "技能描述" },
        category: { type: "string", enum: ["programming", "writing", "research", "customer_service", "data_analysis", "creative", "security", "workflow", "communication", "other"] },
        content: { type: "string", description: "技能內容（Markdown 格式的 SOP 或規則）" },
        triggerCondition: { type: "string", description: "觸發條件（描述何時應使用此技能）" },
      },
      required: ["name", "category", "content"],
    },
  },
  {
    name: "assign_skill",
    description: "將平台上已存在的 skill 指派給自己",
    input_schema: {
      type: "object",
      properties: { skillId: { type: "string", description: "skill UUID（先用 list_skills 查詢）" } },
      required: ["skillId"],
    },
  },
  {
    name: "remove_skill",
    description: "從自己身上移除某個 skill",
    input_schema: {
      type: "object",
      properties: { skillId: { type: "string", description: "skill UUID" } },
      required: ["skillId"],
    },
  },
  {
    name: "update_system_prompt",
    description: "更新自己的 system prompt",
    input_schema: {
      type: "object",
      properties: { systemPrompt: { type: "string", description: "新的 system prompt 內容" } },
      required: ["systemPrompt"],
    },
  },
  {
    name: "list_agents",
    description: "列出所有 agents 的基本資訊（ID、名稱、角色、狀態）",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_agent",
    description: "建立子 agent（自動設為你的子代）。僅限 orchestrator 或 both 角色可用",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent 名稱" },
        description: { type: "string", description: "Agent 描述" },
        systemPrompt: { type: "string", description: "Agent 的 system prompt" },
        primaryModel: { type: "string", description: "使用的 LLM 模型（預設 gemma-4-31b-it；需要本地路由時可改用 ollama/gemma4:*）" },
        role: { type: "string", enum: ["orchestrator", "worker", "both"] },
      },
      required: ["name"],
    },
  },
  {
    name: "update_agent",
    description: "更新子 Agent 的資訊（如名稱、顏色、系統提示詞）。僅限 orchestrator 或 both 角色可用且僅能修改自己的子代",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "要更新的子 Agent ID" },
        name: { type: "string", description: "新的名稱" },
        themeColor: { type: "string", description: "新的主題顏色 (Hex Code, 例如 #7C3AED)" },
        systemPrompt: { type: "string", description: "注入/更新子 Agent 的系統提示詞（會記錄歷史並在指揮中心顯示）" },
      },
      required: ["agentId"],
    },
  },
  {
    name: "assign_tool_to_agent",
    description: "將 tool 指派給其他 agent",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "目標 agent UUID" },
        toolId: { type: "string", description: "tool UUID" },
      },
      required: ["agentId", "toolId"],
    },
  },
  {
    name: "assign_skill_to_agent",
    description: "將 skill 指派給其他 agent",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "目標 agent UUID" },
        skillId: { type: "string", description: "skill UUID" },
      },
      required: ["agentId", "skillId"],
    },
  },
  {
    name: "create_task",
    description: "建立任務並選擇性指派給某 agent",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "任務標題" },
        description: { type: "string", description: "任務詳細描述" },
        agentId: { type: "string", description: "負責的 agent UUID（可選）" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        input: { type: "object", description: "任務輸入資料" },
      },
      required: ["title"],
    },
  },
  {
    name: "run_task",
    description: "執行指定任務",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string", description: "任務 UUID" } },
      required: ["taskId"],
    },
  },
  {
    name: "list_tasks",
    description: "列出任務清單，可依 agentId 或狀態篩選",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "篩選特定 agent 的任務" },
        status: { type: "string", enum: ["pending", "running", "success", "failed", "cancelled"] },
      },
      required: [],
    },
  },
  {
    name: "get_task_result",
    description: "查詢任務執行結果和狀態",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string", description: "任務 UUID" } },
      required: ["taskId"],
    },
  },
  {
    name: "orchestrate",
    description: "以自己作為主控，用 ACP 偽代碼協調多個 worker agents 完成大型任務並整合結果。僅限 orchestrator 或 both 角色",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "要協調完成的任務描述（orchestrator 內部用，最終向用戶回報需用中文）" },
        workerIds: { type: "array", items: { type: "string" }, description: "指定 worker agent UUID 列表（可選，不填則使用所有 worker）" },
        workerModelOverride: { type: "string", description: "覆蓋所有 worker 使用的模型，例如 gemma-4-31b-it 或 ollama/gemma4:31b（可選）" },
        maxTurns: { type: "number", description: `最大 subtask 數量（預設 ${ORCHESTRATE_MAX_TURNS}，上限 ${ORCHESTRATE_MAX_TURNS}）` },
      },
      required: ["task"],
    },
  },
  {
    name: "council_plan",
    description: "Plan whether a topic should escalate into a council, including seats, rounds, and template",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Debate topic" },
        context: { type: "string", description: "Optional extra context" },
        goal: { type: "string", description: "What decision or output is needed" },
        preferredModel: { type: "string", description: "Default model for seats" },
        maxSeats: { type: "number", description: "Clamp planned seat count" },
      },
      required: ["topic"],
    },
  },
  {
    name: "council_create",
    description: "Create a council session. Can auto-plan seats and optionally auto-run the debate",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Session title" },
        topic: { type: "string", description: "Debate topic" },
        context: { type: "string", description: "Optional extra context" },
        goal: { type: "string", description: "Desired decision or deliverable" },
        rounds: { type: "number", description: "1 or 2 debate rounds" },
        moderator_model: { type: "string", description: "Moderator model name" },
        seats: { type: "array", items: { type: "object" }, description: "Council seats; each seat may set role, model, systemPrompt, bias, and tools" },
        preferredModel: { type: "string", description: "Default model when auto-planning seats" },
        maxSeats: { type: "number", description: "Clamp planned seat count" },
        autoPlan: { type: "boolean", description: "Force auto-planning even if seats are omitted" },
        autoRun: { type: "boolean", description: "Run immediately after creation" },
        ownerAgentId: { type: "string", description: "Optional owner agent UUID used for seat tool permissions" },
        resume: { type: "boolean", description: "Reuse existing completed turns if auto-running" },
        forceRestart: { type: "boolean", description: "Delete old transcript and start fresh if auto-running" },
        staleAfterMinutes: { type: "number", description: "Treat running sessions older than this as stale" },
      },
      required: ["topic"],
    },
  },
  {
    name: "council_run",
    description: "Run, resume, or force-restart an existing council session",
    input_schema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Council session id" },
        resume: { type: "boolean", description: "Reuse existing completed turns" },
        forceRestart: { type: "boolean", description: "Delete old transcript and rerun from scratch" },
        staleAfterMinutes: { type: "number", description: "Treat running sessions older than this as stale" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "council_get",
    description: "Get a council session bundle, or the latest sessions when sessionId is omitted",
    input_schema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Council session id; omit to list recent sessions" },
        includeTurns: { type: "boolean", description: "Include transcript turns" },
        includeConclusion: { type: "boolean", description: "Include final moderator conclusion" },
      },
      required: [],
    },
  },
  {
    name: "schedule_task",
    description: "排程任務：在指定時間自動執行某個 agent 的任務",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "負責執行任務的 agent UUID" },
        title: { type: "string", description: "任務標題" },
        description: { type: "string", description: "任務詳細描述" },
        scheduledAt: { type: "string", description: "排程執行時間，ISO 8601 格式，例如 2026-03-12T09:00:00+08:00" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "優先級（預設 medium）" },
      },
      required: ["agentId", "title", "scheduledAt"],
    },
  },
  {
    name: "list_directory",
    description: "列出專案目錄結構（唯讀）",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "目錄路徑（例如 'src/app'，預設為根目錄）" } },
      required: [],
    },
  },
  {
    name: "read_file",
    description: "讀取 src/ 目錄下的檔案內容（唯讀，上限 8000 字元）",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "檔案路徑（例如 'src/app/api/agents/route.ts'）" } },
      required: ["path"],
    },
  },
  {
    name: "request_review",
    description: "提交高風險操作審查請求（write_file 等需要 CEO 核准的操作必須先過審）",
    input_schema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["write_file", "create_api", "db_change", "install_package", "other"] },
        title: { type: "string", description: "請求標題" },
        description: { type: "string", description: "詳細說明要做什麼" },
        impact: { type: "string", description: "影響範圍評估" },
        payload: { type: "object", description: "附加資料" },
      },
      required: ["actionType", "title", "description"],
    },
  },
  {
    name: "get_review_status",
    description: "查詢審查請求狀態（pending/approved/rejected）",
    input_schema: {
      type: "object",
      properties: { reviewId: { type: "string", description: "審查請求 UUID" } },
      required: ["reviewId"],
    },
  },
  {
    name: "save_document",
    description: "將文字內容（文案、報告、文章等）儲存到平台文件庫，不需要審查",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "文件標題" },
        content: { type: "string", description: "文件內容（支援 Markdown）" },
        tags: { type: "array", items: { type: "string" }, description: "標籤，例如 ['SEO', '社群媒體', '草稿']" },
        sourceUrl: { type: "string", description: "內容來源網址（可選）" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "list_documents",
    description: "列出文件庫中的文件，可依標籤或關鍵字篩選",
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "依標籤篩選" },
        keyword: { type: "string", description: "依標題關鍵字搜尋" },
        limit: { type: "number", description: "回傳筆數（預設 20）" },
      },
      required: [],
    },
  },
  {
    name: "read_document",
    description: "讀取文件庫中特定文件的完整內容",
    input_schema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "文件 UUID" },
      },
      required: ["documentId"],
    },
  },
  {
    name: "checkpoint",
    description: "YIELD_STATE：儲存壓縮記憶並排程繼續執行。當任務未完成、接近 context 上限、或需要分段時必須呼叫。",
    input_schema: {
      type: "object",
      properties: {
        thoughtProcess: { type: "string", description: "一句話說明現在的思考邏輯（用於 debug）" },
        progress: { type: "string", description: "已完成的進度摘要（100字內）" },
        yieldSummary: { type: "string", description: "壓縮記憶：傳給下一輪 agent 的完整上下文，包含已知事實、已嘗試方法、當前狀態（200字內）" },
        nextSteps: { type: "string", description: "下一輪要執行的具體指令" },
        output: { type: "object", description: "目前產出的結構化資料（可選）" },
        delaySeconds: { type: "number", description: "多少秒後繼續執行（預設 5，最大 300）" },
      },
      required: ["progress", "yieldSummary", "nextSteps"],
    },
  },
  {
    name: "write_file",
    description: "將內容寫入 src/ 目錄下的檔案（需要已核准的 reviewId）",
    input_schema: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "已核准的審查請求 UUID" },
        path: { type: "string", description: "要寫入的檔案路徑（必須在 src/ 目錄下）" },
        content: { type: "string", description: "檔案內容" },
      },
      required: ["reviewId", "path", "content"],
    },
  },
  {
    name: "report_changes",
    description: "write_file 執行後必須呼叫此工具回報變更，讓主腦（VP）複查",
    input_schema: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "審查請求 UUID" },
        changedFiles: { type: "array", items: { type: "string" }, description: "實際寫入的檔案路徑列表" },
        summary: { type: "string", description: "簡述做了什麼改動" },
      },
      required: ["reviewId", "changedFiles", "summary"],
    },
  },
  {
    name: "trigger_n8n_workflow",
    description: "觸發 n8n Webhook 工作流，讓 n8n 執行固定 SOP（例如：Gumroad 上架、Notion 建頁、Email 通知）。n8n 完成後會自動回呼平台更新任務狀態。",
    input_schema: {
      type: "object",
      properties: {
        webhookUrl: { type: "string", description: "n8n Webhook Trigger 的 URL（從 n8n 複製）" },
        taskId: { type: "string", description: "此任務的 UUID，n8n 完成後用來回報結果" },
        payload: { type: "object", description: "傳給 n8n 的額外資料（依工作流需求填寫）" },
      },
      required: ["webhookUrl", "taskId"],
    },
  },
  // ── Content Pipeline ──────────────────────────────────────────────────────
  {
    name: "hunt_content",
    description: "觸發 Data Hunter 爬取 YouTube 影片（背景非同步執行，完成後透過 callback 回報）",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["patrol", "backfill", "cleanup", "stats"], description: "patrol=每日新影片 / backfill=歷史補抓 / cleanup=清理 / stats=統計（預設 patrol）" },
        channel: { type: "string", description: "指定頻道 slug（可選，僅 backfill 模式有效）" },
      },
      required: [],
    },
  },
  {
    name: "transcribe_content",
    description: "觸發 WhisperX 批次轉錄已下載的音頻檔（背景非同步執行，完成後透過 callback 回報）",
    input_schema: {
      type: "object",
      properties: {
        video_id: { type: "string", description: "指定單支影片 ID（可選，不填則批次轉錄）" },
        limit: { type: "number", description: "批次上限（預設 5，最多 20）" },
      },
      required: [],
    },
  },
  {
    name: "generate_article",
    description: "從知識庫語意搜尋相關內容 → 以 Gemma 預設生成繁體中文 HTML 文章 → 自動存入 generated_articles 表，可在 /blog 看到。需先完成 embed_documents。",
    input_schema: {
      type: "object",
      properties: {
        topic:       { type: "string", description: "文章主題，例如：「如何用 AI 做 SEO」" },
        tag:         { type: "string", description: "只從這個 tag 的文件搜尋（可選，例如 youtube）" },
        color:       { type: "string", description: "文章標籤顏色 hex（預設 #8B5CF6）" },
        chunk_limit: { type: "number", description: "引用幾段知識（預設 8，最多 15）" },
      },
      required: ["topic"],
    },
  },
  {
    name: "export_csv",
    description: "將表格資料匯出並儲存為本機 CSV 檔案（存放在使用者的 Downloads 目錄下）。這是唯一允許直接寫入系統檔案的特權工具，不需審核。",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "CSV 檔案名稱（例如 data.csv）" },
        headers: { type: "array", items: { type: "string" }, description: "CSV 標題列陣列" },
        rows: { type: "array", items: { type: "array" }, description: "CSV 資料列（二維陣列）" },
      },
      required: ["filename", "headers", "rows"],
    },
  },
];
