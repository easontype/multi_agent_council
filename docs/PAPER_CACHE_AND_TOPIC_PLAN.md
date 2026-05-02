# Council — Paper Cache & Topic Selection Plan

> 版本：v1.0 · 2026-05-02  
> 範圍：論文處理快取層 + 多主題辯論選擇  
> 原則：paper 實體與 session 分離；處理只做一次；主題自由組合

---

## 背景與動機

### 目前的問題

| 情境 | 現況 | 代價 |
|------|------|------|
| Debate 失敗後 rerun | 重新跑 marker + RAG ingest | 浪費 7–15 秒、消耗 marker credits |
| 同一篇論文開第二場辯論 | 重新上傳、重新處理 | 雙倍 chunks、雙倍向量索引 |
| 想換角度討論 | 必須重建整個 session | 無法重用先前的 RAG library |
| 主題固定 | session.topic 在建立時寫死 | 無法探索論文不同面向 |

### 目標

1. **論文處理結果永久快取**：同一篇論文（arxiv_id 或 checksum 相同）只處理一次，marker + RAG 結果存 DB，所有 sessions 共用。
2. **Session 失敗不影響快取**：debate 掛掉可立即 rerun，論文資料完好。
3. **主題自由選擇**：用戶開新 session 時可選預設主題或自訂，同一篇論文可有多場不同角度的辯論。
4. **Papers 瀏覽頁**：讓用戶看到「已處理的論文」並從中快速開啟新辯論。

---

## 架構設計

### 實體分離

```
papers（新表）
  ├── 論文本體：title, abstract, source_url, arxiv_id, checksum_sha256
  ├── 處理結果：markdown_content, marker_processed, library_id
  └── 狀態機：processing_status (pending → processing → done / failed)
       ↑
       │ 1 paper : N sessions
       ↓
council_sessions（現有，加 paper_id FK）
  ├── 辯論設定：topic, goal, seats, rounds
  └── 執行狀態：status, heartbeat, turns…
```

### 快取命中邏輯

```
用戶提交論文
  │
  ├─ arXiv URL → 提取 arxiv_id
  │    └─ SELECT * FROM papers WHERE arxiv_id = $1
  │
  └─ 上傳 PDF → 計算 checksum_sha256
       └─ SELECT * FROM papers WHERE checksum_sha256 = $1
  │
  ├─ 命中 + processing_status = 'done'
  │    → 直接進入主題選擇（0 秒，0 credits）
  │
  ├─ 命中 + processing_status = 'processing'
  │    → 顯示進度 polling，等待完成
  │
  ├─ 命中 + processing_status = 'failed'
  │    → 顯示錯誤 + 提供 retry 按鈕
  │
  └─ 未命中
       → INSERT paper → 啟動 marker 處理 → 更新 paper（非 session）
```

---

## 資料庫設計

### 新表：`papers`

```sql
CREATE TABLE papers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 識別與去重
  arxiv_id          TEXT UNIQUE,           -- e.g. "1706.03762"
  checksum_sha256   TEXT,                  -- uploaded PDF fingerprint

  -- 論文資訊
  title             TEXT NOT NULL DEFAULT '',
  abstract          TEXT,
  authors           TEXT[],
  year              INTEGER,
  source_url        TEXT,                  -- 原始 arXiv URL 或 "upload"

  -- 處理結果
  markdown_content  TEXT,                  -- marker 輸出（含 chunk anchors）
  library_id        TEXT,                  -- RAG vector store id（所有 sessions 共用）
  marker_processed  BOOLEAN DEFAULT FALSE,
  processing_status TEXT DEFAULT 'pending',
                                           -- pending | processing | done | failed
  processing_error  TEXT,                  -- 最後一次失敗原因
  processing_attempts INTEGER DEFAULT 0,

  -- 統計（快取展示用）
  total_chunks      INTEGER,
  total_sections    INTEGER,
  page_count        INTEGER,

  -- 時間戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX papers_arxiv_id_idx ON papers (arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX papers_checksum_idx ON papers (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;
```

### `council_sessions` 修改

```sql
ALTER TABLE council_sessions
  ADD COLUMN paper_id UUID REFERENCES papers(id) ON DELETE SET NULL;

-- 舊 sessions 無 paper_id → NULL，降級維持現有行為
CREATE INDEX council_sessions_paper_id_idx ON council_sessions (paper_id)
  WHERE paper_id IS NOT NULL;
```

### 遷移策略（舊 sessions）

```
對每個現有 session：
  1. 從 session.context 提取 arxiv_id（regex）
  2. 若找到 → 查 papers 表
       有 → UPDATE council_sessions SET paper_id = papers.id
       無 → INSERT INTO papers + UPDATE
  3. 若無法提取 → paper_id 保持 NULL（降級，不影響功能）
```

---

## 主題選擇設計

### 預設主題模板

```typescript
export const PAPER_TOPIC_PRESETS = [
  {
    id: 'methodology',
    label: '方法論審查',
    icon: 'Flask',
    topic: 'Methodological soundness of the research design',
    goal: 'Identify design flaws, confounds, or gaps in the methodology',
  },
  {
    id: 'novelty',
    label: '新穎性評估',
    icon: 'Sparkle',
    topic: 'Novelty and contribution relative to prior art',
    goal: 'Assess whether the claims genuinely exceed the state of the art',
  },
  {
    id: 'reproducibility',
    label: '再現性風險',
    icon: 'ArrowsClockwise',
    topic: 'Reproducibility and experimental rigor',
    goal: 'Evaluate whether results can be independently replicated',
  },
  {
    id: 'statistics',
    label: '統計效度',
    icon: 'ChartBar',
    topic: 'Statistical validity and analytical soundness',
    goal: 'Check for p-hacking, underpowered samples, or misused tests',
  },
  {
    id: 'impact',
    label: '實務應用性',
    icon: 'Rocket',
    topic: 'Practical impact and real-world deployment readiness',
    goal: 'Determine whether the approach is ready for production use',
  },
  {
    id: 'custom',
    label: '自訂主題',
    icon: 'PencilSimple',
    topic: '',   // 用戶填寫
    goal: '',    // 用戶填寫（選填）
  },
] as const
```

### UI Flow（`/review/new`）

```
Step 1：論文來源
┌─────────────────────────────────────────────────────────┐
│  arXiv URL  ┌────────────────────────────────────────┐  │
│             │ https://arxiv.org/abs/1706.03762        │  │
│             └────────────────────────────────────────┘  │
│  或上傳 PDF  [選擇檔案]                                  │
│                                                          │
│  ✅ 已在快取 · Attention Is All You Need · 15 頁 · 87 chunks │
│  ⚡ 處理中（預計 8 秒）                                   │← status variants
│  ❌ 處理失敗 [重試]                                       │
└─────────────────────────────────────────────────────────┘

Step 2：討論主題
┌─────────────────────────────────────────────────────────┐
│  快速選擇                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 🔬 方法論審查│ │ ✨ 新穎性評估│ │ 🔁 再現性風險│      │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 📊 統計效度  │ │ 🚀 實務應用性│ │ ✏️ 自訂主題  │      │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  選擇「自訂主題」時展開：                                │
│  主題  ┌──────────────────────────────────────────┐     │
│        │ 這篇論文的 attention 機制是否優於 RNN？   │     │
│        └──────────────────────────────────────────┘     │
│  目標  ┌──────────────────────────────────────────┐     │
│        │ 評估是否值得在生產環境替換現有 LSTM 架構  │     │
│        └──────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘

Step 3：Agent 配置（現有流程，不變）
```

### 同篇論文的 Sessions 展示

在 paper 詳情頁或 review 列表加入分組視圖：

```
📄 Attention Is All You Need (Vaswani et al., 2017)
   ✅ 已處理 · 15 頁 · 87 chunks · 12 sections
   
   討論記錄
   ├── 方法論審查  · 2026-04-28 · 已結論  [查看]
   ├── 新穎性評估  · 2026-05-01 · 已結論  [查看]
   └── [+ 從此論文開啟新討論]
```

---

## 實作 Phases

### Phase P1 — DB + 處理快取層（後端）

**目標：** papers 表建立；上傳/URL 流程改走 paper 查重邏輯

**工作項目：**
- [ ] `ensureCouncilSchema()` 加入 `papers` 表 + `council_sessions.paper_id`
- [ ] `paper-ingest.ts` 重構：處理結果寫 `papers`，不寫 `sessions`
- [ ] 新增 `findOrCreatePaper(source)` 函數：按 arxiv_id / checksum 查重
- [ ] `library_id` 改為 paper-scoped（一份向量索引所有 sessions 共用）
- [ ] 遷移腳本：從舊 sessions 回填 `paper_id`

**驗收：**
- 同一篇 arXiv 論文兩次提交 → 第二次命中快取，`processing_status = done`，不重新 marker

---

### Phase P2 — 主題選擇 UI（前端）

**目標：** `/review/new` 加入 Step 2 主題選擇；session 建立 API 接收 topic preset

**工作項目：**
- [ ] 新增 `PAPER_TOPIC_PRESETS` 常數檔
- [ ] `/review/new` 表單：paper 選擇 + 快取狀態顯示 + 主題選擇步驟
- [ ] 快取命中 badge（已處理 / 處理中 / 失敗 + retry）
- [ ] 自訂主題展開輸入框
- [ ] Session 建立 API 傳入 `paper_id` + `topic` + `goal`

**驗收：**
- 用戶選「方法論審查」→ session.topic/goal 自動填入對應模板
- 同篇論文第二次進入表單 → 立即顯示「已在快取」badge

---

### Phase P3 — Papers 頁面 + 多 Session 視圖（前端）

**目標：** 讓用戶瀏覽已處理的論文，快速從同一篇論文開啟新角度的辯論

**工作項目：**
- [ ] `/home/papers` 路由：列出所有 papers + 處理狀態
- [ ] Paper 卡片：title, authors, year, chunk 數、section 數
- [ ] 點擊 paper → 展開該論文的所有 sessions（依主題分組）
- [ ] 「從此論文開啟新討論」按鈕 → 帶入 paper_id 跳轉 `/review/new`
- [ ] 導覽列加入 Papers 入口

**驗收：**
- 同一篇論文的不同主題 sessions 在同一個卡片下聚合顯示

---

### Phase P4 — AI 主題建議（選做）

**目標：** 用 paper abstract 自動推薦 2–3 個最值得討論的角度

**工作項目：**
- [ ] 新增 `/api/papers/[id]/suggest-topics` endpoint
- [ ] 用 Claude 分析 abstract → 回傳推薦 topics（附理由）
- [ ] Step 2 UI 加入「AI 建議」區塊，可一鍵套用

---

## 依賴關係

```
P1（快取層）
  └─ P2（主題 UI）— 依賴 P1 的 findOrCreatePaper + paper_id
       └─ P3（Papers 頁）— 依賴 P1 資料 + P2 的 session 主題欄位
            └─ P4（AI 建議）— 依賴 P1 paper 資料
```

**可並行：**
- P2 前端可先用 mock paper_id 開發，不等 P1 完成
- P3 Papers 頁可與 P2 並行，都只需 P1 資料

---

## 關鍵決策記錄

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| library_id 範圍 | paper-scoped | 避免每個 session 建立重複的向量索引，節省成本 |
| 去重 key | arxiv_id（優先）＋ checksum_sha256（fallback） | arXiv 論文 ID 穩定可靠；上傳 PDF 用 checksum |
| 舊 sessions 相容性 | paper_id nullable，降級維持現有行為 | 不 breaking change，遷移可漸進 |
| 主題選擇位置 | session 建立流程的獨立 Step，非 session 執行時 | 主題決定 prompt，需在 seats 配置之前確認 |
| 快取失效策略 | 不失效（論文 PDF 是不變的） | 唯一例外：用戶明確要求 re-process（提供手動 invalidate 按鈕） |
| processing_status 狀態機 | pending→processing→done/failed | 支援 polling UI + retry 邏輯 |

---

## 未解決問題（開工前確認）

1. **RAG library 遷移**：現有 sessions 的 `library_id` 是 session-scoped，要改為 paper-scoped 需要確認 RAG 服務的 API 支援 library 共用（同一 library_id 可被多個 session 查詢）。
2. **PDF 原始檔儲存**：要回填舊論文的 paper 記錄，需要能取得原始 PDF。已上傳的檔案存在哪？`uploaded_files` 表？還是只有 chunks？
3. **多工作區（workspace）**：papers 是否跨 workspace 共用，還是每個 workspace 有獨立的 paper 快取？（建議先做 workspace-scoped，更安全）
4. **處理中 polling**：前端要用 SSE 還是 short polling 來等待 `processing_status = done`？建議沿用現有 SSE 架構。
