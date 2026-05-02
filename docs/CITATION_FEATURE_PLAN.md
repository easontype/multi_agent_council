# Council — Citation UI Feature Plan

> 版本：v1.1 · 2026-05-02  
> 範圍：辯論 citation 體驗全面升級 + PDF 原文渲染（marker 整合）  
> 原則：不動現有邏輯，逐 phase 疊加；每個 phase 獨立可測試

---

## 一、目標與設計決策摘要

### 使用者需求
在辯論輸出中，讓用戶能夠：
1. 看到 citation 的作者、年份、論文名（hover）
2. 點擊 citation 跳到原文位置（含上下文）
3. 清楚辨別三種來源類型（本地 PDF / 學術索引 / 網路文章）
4. 在不離開辯論的前提下深度探索引用來源

### 已確認設計決策

| 決策點 | 選擇 |
|--------|------|
| Inline citation 互動 | Popover 快覽（方案 C） |
| 完整原文位置 | 右側面板 原文閱讀 Tab（方案 A） |
| 作者顯示時機 | Hover tooltip 顯示作者 + 年份 + 論文名 |
| 來源類型區分 | 不同底線顏色 + 不同 icon |
| Citation 精準度 | 實線（marker 對應）vs 虛線（heuristic 推算） |
| 右側面板模式 | Tab 切換：原文閱讀 / Citations / 辯論 Flow |
| 左側面板模式 | Toggle 切換：辯論訊息（預設）/ Agent 比較 / 缺口地圖 |
| PDF 渲染方式 | marker 轉 Markdown → UI 內建渲染（取代外部 PDF viewer） |
| 缺口地圖章節警示 | 依 section 語意分級：Limitation/Discussion 未引用 = 橘色警示，其餘灰色 |

---

## 二、整體 UI 架構

```
┌──────────────────────────────────────────────────────────────────┐
│  LEFT PANEL                    │  RIGHT PANEL                    │
│  [辯論訊息 | Agent比較 | 缺口地圖]  │  [原文閱讀 | Citations | Flow]  │
│                                │                                  │
│  ── 預設：辯論訊息流 ──          │  ── 預設：Citations ──           │
│                                │                                  │
│  [Agent Avatar] Methods Critic │  Source Panel (升級版)            │
│                                │                                  │
│  "本研究方法在小樣本條件下       │  📄 Smith et al., 2023           │
│   存在顯著偏誤 ────────"        │  "Attention is All You Need"     │
│          ↑                     │  cited by: Methods Critic (R1)   │
│          Popover 在此展開       │  ⚠ 與 Constructive 立場相反      │
│                                │                                  │
│  ── Agent 比較模式 ──           │  ── 原文閱讀模式 ──              │
│                                │                                  │
│  [Agent A] ←→ [Agent B]        │  Section 3.2 · p.12             │
│  立場並排 + 相同來源標記         │  ...前文 context...              │
│                                │  ████ 高亮被引段落 ████          │
│  ── 缺口地圖模式 ──             │  ...後文 context...              │
│                                │                                  │
│  文件熱力圖：                   │  ── 辯論 Flow 模式 ──            │
│  哪些段落從未被引用              │  Round 1 → Round 2 連線圖        │
│  （橘色 = 潛在研究盲點）         │  誰挑戰了誰的哪個論點            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、Citation 視覺系統

### 來源類型 × 精準度 = 6 種視覺狀態

| 狀態 | Icon | 底線顏色 | 底線樣式 | 定義 |
|------|------|---------|---------|------|
| 本地 PDF · 確定 | 📄 | `amber-600` | 實線 | 有 `[n]` marker + 本地文件 |
| 本地 PDF · 推測 | 📄 | `amber-400` | 虛線 | heuristic 文字配對 |
| 學術索引 · 確定 | 📚 | `blue-600` | 實線 | arXiv / OpenAlex / Semantic Scholar |
| 學術索引 · 推測 | 📚 | `blue-400` | 虛線 | 無 marker，標題配對 |
| 網路文章 · 確定 | 🌐 | `teal-600` | 實線 | web_search / fetch_url 有 URI |
| 網路文章 · 推測 | 🌐 | `teal-400` | 虛線 | 無 URI，heuristic 配對 |

> **注意：** icon 使用 Phosphor Icons SVG，非 Emoji（遵循設計規範）

### Hover Tooltip 結構

```
┌─────────────────────────────────────────────┐
│  📄  Smith, J., Jones, K., et al.  · 2023   │
│  "Attention Mechanisms in Low-Resource NLP"  │
│  Nature Machine Intelligence  · arXiv:xxxx   │
│  ──────────────────────────────────────────  │
│  相似度 87% · 系統推算配對                   │  ← 僅 heuristic 時顯示
└─────────────────────────────────────────────┘
```

### Popover 結構（點擊後展開）

```
┌─────────────────────────────────────────────┐
│  📄  Smith et al., 2023                      │
│  "Attention Mechanisms in..."  [↗ arXiv]    │
│  ─────────────────────────────────────────  │
│  Section 3.2 · Methodology · p.12           │
│                                              │
│  ...the proposed framework relies on the    │
│  assumption that labeled data is scarce...   │
│  ████████████████████████████████████████  │← 被引段落高亮
│  However, when applied to zero-shot tasks,  │
│  the model demonstrates significant...       │
│  ─────────────────────────────────────────  │
│  ≈ 87% match  [在文件中定位 →]              │
└─────────────────────────────────────────────┘
```

---

## 四、Phase 規劃

---

### Phase 0 — 資料地基（Backend Only）

**目標：** 補齊後端缺少的 metadata，讓後續 UI phase 有資料可用。  
**不動：** 前端任何元件  
**依賴：** 無

#### 0-A：documents 表擴欄

| 新增欄位 | 型別 | 來源 |
|---------|------|------|
| `authors` | `text[]` | arXiv API metadata / PDF header parse |
| `year` | `integer` | arXiv metadata / PDF parse |
| `venue` | `text` | arXiv 分類 / journal 名 |
| `source_type` | `enum` | `local_pdf` / `academic` / `web` |

#### 0-B：CouncilEvidenceSource 擴欄

| 新增欄位 | 型別 | 用途 |
|---------|------|------|
| `chunk_index` | `integer \| null` | 定位原文位置，RAG 結果帶入 |
| `source_type` | `string` | `local_doc` / `academic` / `web` |
| `similarity_score` | `number \| null` | RAG vector search 的 score |
| `is_heuristic` | `boolean` | `true` = 無 marker，前端推算配對 |

> `is_heuristic` 在 `buildEvidenceAnnotations()` 計算後寫入 sourceRef，不需後端額外邏輯

#### 0-C：Chunk Context API

新增端點：`GET /api/documents/[docId]/chunks/[chunkIndex]/context`

```
Response:
{
  before: ChunkContent[],   // ±2 chunks
  target: ChunkContent,     // 被引 chunk
  after: ChunkContent[],    // ±2 chunks
  sectionHeading: string | null,
  pageEstimate: number | null
}
```

#### 0-D：Paper Ingest 補充 Section Heading 萃取

原規劃為 regex 偵測，**已由 Phase 0-E（marker 整合）取代**。marker 的語意 heading 偵測準確率遠高於 regex。0-D 的資料模型（`document_chunks.section_heading` 欄位）仍需建立，由 marker pipeline 填入。

#### 0-E：marker PDF-to-Markdown 微服務（新增）

**背景：** 現有 PDF 閱讀體驗使用外部 PDF viewer，醜且無法與 citation 高亮整合。  
**方案：** 用 [datalab-to/marker](https://github.com/datalab-to/marker) 將 PDF 轉成高品質 Markdown，存入資料庫，UI 直接渲染。

---

**marker 技術特性（API 實測確認，2026-05-02）：**

測試論文：Attention Is All You Need（arXiv:1706.03762，15 頁）

| 特性 | 狀況 | 實測結果 |
|------|------|---------|
| 輸出格式 | Markdown | ✅ 54,575 chars，結構完整 |
| Section heading | ✅ 語意偵測 | `#` `##` `###` `####` 完整四層，12 個章節全部正確 |
| 表格 | ✅ | Markdown table，作者欄也以 table 形式保留 |
| LaTeX 公式 | ✅ | `$$\text{Attention}(Q,K,V)=\text{softmax}(\frac{QK^T}{\sqrt{d_k}})V$$` 格式正確 |
| Inline math | ✅ | `$d_k$`, `$N=6$` 等 inline 公式均保留 |
| 頁碼 | ❌ | 頁首/頁尾被清除，但 `metadata.page_stats` 保留 `{page_id, num_blocks}` |
| 作者資訊 | ✅ | 保留在第一個 Markdown table，可 parse 萃取 |
| Parse quality score | 4.6 / 5.0 | - |
| 速度 | 7.1 秒 / 15 頁 | 雲端 API，無需本地 GPU |
| Cost | 6 credits / 論文 | 需確認 plan 額度 |
| chunks / json 欄位 | None | 預設 `output_format=markdown` 時為 null，需另外研究 |
| REST API | ✅ 雲端 | POST `/api/v1/marker`，非同步，平均 <10 秒回應 |
| 授權 | MIT | - |

---

**服務架構（已從自架 microservice 改為直接呼叫雲端 API）：**

不需要部署 Python 微服務。`paper-ingest.ts` 直接打 marker cloud API：

```
paper-ingest.ts (Node.js)
  → POST https://www.datalab.to/api/v1/marker
    headers: { X-API-Key: process.env.MARKER_API_KEY }
    body: multipart/form-data { file: pdfBuffer, output_format: "markdown" }
  ← { request_id: "tGo1FT_..." }

  → 輪詢 GET https://www.datalab.to/api/v1/marker/{request_id}
  ← {
      status: "complete",
      markdown: "# Attention Is All You Need\n\n...",
      metadata: { page_stats: [{page_id: 0, num_blocks: 10}, ...] },
      parse_quality_score: 4.6,
      page_count: 15
    }

  → 後處理（Node.js 本地，不需 Python）：
    a. parse heading lines → sections[]（heading + char range）
    b. 對每個 existing chunk 計算 char_offset（fuzzy match chunk text in markdown）
    c. 在 markdown 中注入 chunk anchors
    d. 從第一個 table 萃取作者資訊

  → 存入 documents.markdown_content（含 anchors）
  → 更新 document_chunks.section_heading + char_offset
  → 更新 documents.authors, documents.marker_processed = true
```

**環境變數新增：**
```
MARKER_API_KEY=...（存 .env.local，不 commit）
```

---

**最難的問題：Chunk → Markdown 位置映射**

這是整個 marker 整合的核心技術挑戰。目標是：用戶點擊 citation（某個 chunk）後，UI 可以 scroll 到 markdown 中該 chunk 對應的段落並高亮。

三種方案比較：

| 方案 | 做法 | 優點 | 缺點 |
|------|------|------|------|
| A. 文字比對 | 在 markdown 中用 fuzzy search 找 chunk 文字 | 不需改 ingest | chunk 文字被 marker 清洗後可能不完全相同，比對失敗率高 |
| B. Char offset 存 DB | ingest 時記錄每個 chunk 在 markdown 的字元起點 | 精確 | marker 清洗後 chunk 邊界可能偏移 |
| C. Anchor 注入 | markdown 中每 600 chars 注入 `<span id="chunk-N" />` | UI 直接 scroll-to-id | 需後處理 markdown，破壞原始格式 |

**選擇：方案 C（Anchor 注入）為主，方案 A 作降級 fallback。**

理由：方案 C 只需在渲染時用 React Markdown 處理 `<span id="chunk-N" />`，UI 層 `document.getElementById('chunk-42').scrollIntoView()` 即可精確定位。若 anchor 找不到（舊文件），fallback 到方案 A 的 fuzzy match。

---

**資料庫擴充（Phase 0-E 需新增）：**

```sql
-- documents 表新增欄
ALTER TABLE documents ADD COLUMN markdown_content TEXT;       -- marker 輸出
ALTER TABLE documents ADD COLUMN marker_processed BOOLEAN DEFAULT FALSE;

-- document_chunks 表新增欄
ALTER TABLE document_chunks ADD COLUMN section_heading TEXT;  -- 所屬章節
ALTER TABLE document_chunks ADD COLUMN char_offset INTEGER;   -- 在 markdown 的起始字元位置
```

---

**API 新增：**

```
GET /api/documents/[id]/markdown
Response: {
  markdown: string,           -- 含 chunk anchor 的完整 markdown
  sections: Section[],        -- [{heading, level, startChar, endChar}]
  markerProcessed: boolean    -- false = 尚未 marker 處理，降級顯示 chunks
}
```

---

**既有文件的回填策略（Backfill）：**

資料庫中已有文件需要跑一次 marker batch job：

```
1. 找出所有 marker_processed = false 的 documents
2. 若 source_url 是 arXiv → 重新下載 PDF → marker 處理
3. 若是用戶上傳 PDF → 需要用戶重新上傳，或從 storage 取回原始檔
4. 處理完更新 markdown_content + marker_processed = true
```

建議：先對新入庫文件啟用，舊文件若無法取得原始 PDF 則降級顯示 chunk 列表。

---

**部署方案（已確認用雲端 API）：**

| 環境 | 方案 |
|------|------|
| 開發 / 生產 | marker cloud API（`www.datalab.to`），7 秒 / 論文，無需 GPU |
| API Key | 存 `.env.local` 的 `MARKER_API_KEY`，不 commit |
| 限流保護 | `paper-ingest.ts` 加 retry + exponential backoff（API 429 時） |
| 費用估算 | 6 credits / 15 頁論文，需確認 plan 額度上限 |

---

### Phase 1 — Citation 視覺類型系統（Frontend Only）

**目標：** 三種來源類型用不同顏色底線 + icon 呈現，實線 vs 虛線區分精準度。  
**依賴：** Phase 0-B（需要 `source_type` 和 `is_heuristic` 欄位）  
**改動範圍：** 僅 `evidence-annotations.ts` + `evidence-annotated-markdown.tsx`

#### 1-A：擴充 EvidenceAnnotation 型別

```typescript
// 新增欄位（不改現有欄位）
interface EvidenceAnnotation {
  // ... 現有欄位 ...
  sourceType: 'local_doc' | 'academic' | 'web'
  isHeuristic: boolean
}
```

#### 1-B：底線 CSS Token 對應

```
source_type + is_heuristic → Tailwind class 組合
local_doc  + false → underline decoration-amber-600 decoration-solid
local_doc  + true  → underline decoration-amber-400 decoration-dashed
academic   + false → underline decoration-blue-600 decoration-solid
academic   + true  → underline decoration-blue-400 decoration-dashed
web        + false → underline decoration-teal-600 decoration-solid
web        + true  → underline decoration-teal-400 decoration-dashed
```

#### 1-C：Hover Tooltip 加入作者資訊

現有 tooltip 顯示 `snippet + label + marker`，擴充加入：
- 作者（來自 sourceRef → document lookup，或直接存在 sourceRef 的 `authors` 欄位）
- 年份
- 論文名（現有 `label` 欄位）
- 相似度 + heuristic 警示（僅 `is_heuristic=true` 時顯示）

#### 1-D：Icon 前綴

在 underline span 前插入 Phosphor icon（小尺寸，inline）：
- `local_doc` → `<FileText size={12} />`
- `academic` → `<GraduationCap size={12} />`
- `web` → `<Globe size={12} />`

---

### Phase 2 — Citation Popover（Frontend + Phase 0）

**目標：** 點擊 citation underline，展開包含原文上下文的 Popover。  
**依賴：** Phase 0-B（chunk_index）、Phase 0-C（context API）、Phase 1（視覺系統）

#### 2-A：CitationPopover 元件

新元件 `src/components/council/citation-popover.tsx`

**觸發：** 點擊任何 citation underline  
**位置：** 相對 citation span，向上或向下展開（避免超出 viewport）  
**關閉：** 點擊外部 / Escape

**內容結構：**
```
Header: source_type icon + 作者 + 年份
Title: 論文名 / 網頁標題 [↗ 外部連結]（若有 URI）
────────────────────────────────
Section Heading · 頁碼（若有）
Context:
  ...before chunk text...
  █████ 高亮被引段落 █████
  ...after chunk text...
────────────────────────────────
Footer: 相似度 score · [在文件中定位 →]（觸發右側面板）
```

**資料流：**
1. 點擊 → 取得 `sourceRef.chunk_index` + `sourceRef.document_id`
2. 若無 chunk_index → 僅顯示 snippet（降級 fallback）
3. 若有 chunk_index → `fetch /api/documents/[id]/chunks/[n]/context`
4. 顯示 context；loading 狀態用 skeleton

#### 2-B：「在文件中定位」觸發

點擊 Popover 底部按鈕 → 發送事件給右側面板，切換至「原文閱讀」Tab 並 scroll 到對應段落。

---

### Phase 3 — 右側面板三 Tab 重構（Frontend）

**目標：** 將現有 SourcePanel 擴充為三 Tab 架構。  
**依賴：** Phase 0-C（原文閱讀需要 context API）、Phase 2（Popover 觸發定位）

#### 3-A：Tab 框架

```tsx
<RightPanel>
  <TabBar>
    <Tab id="citations">Citations</Tab>
    <Tab id="source-reader">原文閱讀</Tab>
    <Tab id="debate-flow">辯論 Flow</Tab>
  </TabBar>
  <TabContent />
</RightPanel>
```

Tab 切換為 client-side state，不影響 URL。

#### 3-B：Tab 1 — Citations（升級現有 SourcePanel）

在現有引用卡片基礎上新增：
- 顯示作者 + 年份
- `source_type` icon
- `is_heuristic` badge（「推算配對」小標籤）
- **⚠ 相同來源，立場相反** 警示（Phase 5 實作，此階段預留 UI 位置）

#### 3-C：Tab 2 — 原文閱讀（整合 marker Markdown 渲染）

元件 `src/components/council/source-reader.tsx`

**狀態：**
- `idle`：顯示「點擊任意 citation 定位到原文」提示
- `loading`：skeleton（等待 markdown fetch）
- `viewing`：渲染完整 markdown，scroll 到目標 chunk 並高亮
- `degraded`：marker 尚未處理此文件，降級顯示 ±2 chunks 的純文字

**佈局：**
```
Header: 文件標題 | 作者 | 年份  [↗ arXiv / 原始 URL]
Sub-header: Section Heading（來自 marker section 偵測）
────────────────────────────────
滾動區域（react-markdown 渲染）：

  # 1. Introduction

  ...前文段落...

  ## 2. Methodology

  ┌──────────────────────────────────────────────┐
  │  █ 高亮被引區塊                               │← chunk anchor scroll 目標
  │  "...the proposed framework relies on..."     │  amber/blue/teal 左側 border
  │  "...assumption that labeled data is..."      │  bg-accent/10
  └──────────────────────────────────────────────┘

  ...後文繼續渲染...

  # 3. Results
  ...
────────────────────────────────
Footer: 進度條（目前閱讀位置 / 文件總長）
        [← 上一個 citation]  [下一個 citation →]
```

**核心技術：**
- 渲染：`react-markdown` + `remark-gfm`（表格）+ `rehype-katex`（公式）
- 定位：`document.getElementById('chunk-42').scrollIntoView({ behavior: 'smooth', block: 'center' })`
- 高亮：目標 chunk anchor 的相鄰段落加上 highlight class
- Fallback：若 `marker_processed = false`，改用 Phase 0-C 的 context API 顯示純文字片段

**定位觸發來源：**
- Popover 的「在文件中定位」按鈕（帶 `chunkIndex`）
- Citations Tab 的引用卡片點擊
- 缺口地圖點擊未引用區段

**導航：**
Footer 的「上一個 / 下一個 citation」讓用戶可以連續瀏覽該文件被引用的所有段落，按 `chunk_index` 排序。

#### 3-D：Tab 3 — 辯論 Flow

元件 `src/components/council/debate-flow-view.tsx`

視覺化辯論結構：
- Round 1 各 agent 論點卡片（橫排）
- Round 2 以連線顯示「誰回應了誰」
- 連線顏色：反駁（rose）/ 支持（green）/ 延伸（neutral）
- 點擊連線 → 高亮左側辯論訊息對應段落

**資料來源：** 現有 `AgentMessage[]`，Round 2 的 prompt 包含 Round 1 的完整內容，可用 agent + round 索引推算回應關係。精確的「回應誰」需 Phase 5 後端支援，此階段先做靜態 Round 1 → Round 2 的時序連線。

---

### Phase 4 — 左側面板 Toggle（Frontend）

**目標：** 左側辯論訊息區加入「Agent 比較」和「缺口地圖」切換模式。  
**依賴：** Phase 0-B（缺口地圖需 chunk 覆蓋率資料）、Phase 3（右側面板框架）

#### 4-A：左側 Toggle 框架

```tsx
<LeftPanel>
  <ModeToggle>
    <ToggleItem id="debate">辯論訊息</ToggleItem>
    <ToggleItem id="compare">Agent 比較</ToggleItem>
    <ToggleItem id="gap-map">缺口地圖</ToggleItem>
  </ModeToggle>
  <ModeContent />
</LeftPanel>
```

#### 4-B：Agent 比較模式

元件 `src/components/council/agent-compare-view.tsx`

**互動流程：**
1. 選擇兩個 Agent（dropdown 或點擊 roster）
2. 左右並排顯示各自發言（Round 1 + Round 2）
3. 相同 source 被兩者引用 → 標記 `shared citation` badge（amber）
4. 相同 source 但立場相反 → 標記 `conflict` badge（rose）

**資料來源：** 現有 `AgentMessage[]` + `SourceRef[]`，純前端計算。

#### 4-C：缺口地圖模式

元件 `src/components/council/gap-map-view.tsx`

**概念：** 將上傳文件的所有 chunks 依序排列，顯示哪些 chunk 被引用過、哪些從未出現在任何 sourceRef 中。

**視覺：**
```
文件：Smith et al., 2023

[██░░░░██████░░░░░░░██████░░░░]
 ↑引用 ↑未引用      ↑密集引用  ↑未引用

Section breakdown:
  § 1. Introduction      ████░░ (4/6 chunks cited)
  § 2. Related Work      ░░░░░░ (0/5 chunks cited) ← ⚠ 潛在盲點
  § 3. Methodology       ██████ (6/6 chunks cited)
  § 4. Results           ██░░░░ (2/5 chunks cited)
  § 5. Discussion        ░░░░░░ (0/4 chunks cited) ← ⚠ 潛在盲點
```

**資料需求：** 需要 API 回傳「此 session 用到了哪些 chunk_index」，與「文件總 chunk 數」對比。

新增端點：`GET /api/sessions/[id]/citation-coverage`

```
Response:
{
  documents: [{
    id, title, totalChunks,
    citedChunkIndices: number[],
    sections: [{ heading, startChunk, endChunk, citedCount }]
  }]
}
```

**互動：** 點擊未引用區段 → 右側面板切換到原文閱讀，顯示該段落，提示「此段落未被任何 reviewer 引用」。

---

### Phase 5 — Citation 智慧層（Backend + Frontend）

**目標：** 偵測跨 Agent citation 衝突、標記未引用主張、提升辯論洞察深度。  
**依賴：** Phase 0 全部、Phase 3、Phase 4

#### 5-A：跨 Agent Citation 衝突偵測

**後端：** 在 session 結束（或 hydration）時，分析所有 sourceRefs：
- 找出同一 `uri` 或 `label` 被 ≥2 個不同 agent 引用的情況
- 比對兩個 agent 的立場（從 moderator conclusion 的 consensus/dissent 推算，或直接 AI classify）
- 寫入 `council_evidence` 的 metadata 或獨立的 `citation_conflicts` 表

**前端：** 
- Citations Tab 的引用卡片顯示衝突警示 `⚠ 立場相反`
- Agent 比較模式自動高亮衝突 citation

#### 5-B：未引用主張標記（Uncited Claims）

策略：Agent 文字中，沒有對應任何 sourceRef 的句子，加上輕微標記。

- 視覺：淡灰色左側邊線（`border-l-2 border-muted`），hover 顯示 tooltip「此段落無 citation 支撐」
- 不應過度強調（非錯誤，是推論），邊線強度低於 citation 底線
- 可加設定開關（預設關閉，用戶手動開啟）

#### 5-C：辯論 Flow 精確回應關係（後端）

在 `council_turns` 表加入 `responds_to_turn_id` 欄位，在 Round 2 執行時記錄每個 seat 回應的對象（從 prompt injection 可推算）。

這讓 Phase 3-D 的辯論 Flow 連線從「靜態時序」升級為「精確回應關係圖」。

---

## 五、依賴關係圖

```
Phase 0 (資料地基)
  ├── 0-A: documents 擴欄（authors, year, source_type）
  ├── 0-B: sourceRefs 擴欄（chunk_index, source_type, score, is_heuristic）← Phase 1、2 依賴
  ├── 0-C: Chunk Context API（±2 chunks）← Phase 2 降級 fallback 依賴
  ├── 0-D: [已由 0-E 取代] section_heading 欄位仍需建立，由 0-E 填入
  └── 0-E: marker 微服務（PDF→Markdown + anchor 注入 + section map）← Phase 3-C 依賴

Phase 1 (視覺類型系統) ← 依賴 0-B
Phase 2 (Citation Popover) ← 依賴 0-B, 1；降級 fallback 依賴 0-C
Phase 3 (右側面板三 Tab)
  ├── 3-B Citations Tab ← 依賴 0-A, 0-B
  ├── 3-C 原文閱讀 Tab ← 依賴 0-E（全功能）/ 0-C（降級 fallback）
  └── 3-D 辯論 Flow Tab ← 依賴現有資料，無新依賴
Phase 4 (左側面板 Toggle)
  ├── Agent 比較 ← 依賴 Phase 3 框架
  └── 缺口地圖 ← 依賴 0-E（section 資訊）+ 新 coverage API
Phase 5 (Citation 智慧層) ← 依賴 Phase 0 全部, 3, 4
```

---

## 六、各 Phase 範圍與複雜度評估

| Phase | 類型 | 改動範圍 | 複雜度 | 核心風險 |
|-------|------|---------|--------|---------|
| 0-A | DB migration | `documents` schema + arXiv metadata fetch | 中 | arXiv API 格式差異 |
| 0-B | TypeScript types + RAG handler | `CouncilEvidenceSource`, `rag.ts`, `hydrator.ts` | 中 | 向後相容舊 session 資料 |
| 0-C | Next.js API route | 新 route file | 低 | 無（作為 0-E 的降級 fallback） |
| 0-E | Python 微服務 + DB migration + Node.js 整合 | 新 `marker-service/`、`paper-ingest.ts`、documents schema | **高** | chunk↔markdown 位置映射；GPU 環境；舊文件 backfill |
| 1 | Frontend only | `evidence-annotations.ts`, `.tsx` | 低 | CSS underline 跨瀏覽器 |
| 2 | Frontend + fetch | 新元件 + API call | 中 | Popover 位置計算 |
| 3-B | Frontend | SourcePanel 升級 | 低-中 | 不能 break 現有 UI |
| 3-C | Frontend + react-markdown | 新元件，依賴 0-E | **高** | Markdown 渲染效能；anchor scroll 精確度；katex 公式渲染 |
| 3-D | Frontend | 新元件，現有資料 | 中 | Round 2 回應關係推算準確性 |
| 4-B | Frontend only | 新元件，純前端計算 | 中 | 無 |
| 4-C | Frontend + new API | 新元件 + 新 route + 0-E section data | 中-高 | Section 語意分類（Limitation 偵測）|
| 5-A | Backend + Frontend | 新分析邏輯 + UI 標記 | 高 | 衝突定義不明確 |
| 5-B | Frontend only | `evidence-annotated-markdown.tsx` | 低-中 | 用戶接受度 |
| 5-C | DB migration + Backend | `council_turns` 擴欄 | 中 | 舊 session 無此欄位 |

---

## 七、不在此計畫範圍內

- Citation 匯出（APA / BibTeX 格式）
- 用戶手動新增或編輯 citation
- Citation graph 可視化（另立計畫）
- Semantic Scholar API 整合（另立計畫，P1 路線圖）
- 行動裝置版佈局調整（另立計畫）

---

## 八、建議執行順序

```
第一週：Phase 0-A + 0-B + 0-C → 資料地基（純後端，不動 UI）
第二週：Phase 1 → 視覺類型系統（低風險，立即可見效果）
第三週：Phase 0-E（marker 微服務）→ 最複雜，需獨立時間
        子任務：
          1. FastAPI wrapper 開發 + Docker compose 設定
          2. chunk anchor 注入邏輯
          3. paper-ingest.ts 整合 + DB migration
          4. 新文件測試（arXiv PDF）
第四週：Phase 2 → Citation Popover
第五週：Phase 3（3-B + 3-D 先，3-C 依賴 0-E 完成）
第六週：Phase 3-C → 原文閱讀 Tab（react-markdown + anchor scroll）
第七週：Phase 4 → 左側 Toggle（Agent 比較 + 缺口地圖）
之後：Phase 5 → 智慧層（選做）
```

**並行可能性：** Phase 0-E（後端 marker 服務）可與 Phase 1、2（純前端）並行開發，互不干擾。
