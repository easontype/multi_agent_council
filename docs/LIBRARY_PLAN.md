# Council Library — 規劃架構與實行計畫

> 目標：把 Council 從「單篇閱讀工具」升級為「AI-native 文獻研究工作台」，對標 Zotero + AI。
> 撰寫日期：2026-06-03

---

## 產品定位

| 現在 | 目標 |
|------|------|
| 上傳一篇 PDF → 閱讀 + hover AI | 管理整個文獻庫 → 閱讀 + 翻譯 + 批注 + AI 分析 |
| 論文彼此孤立 | Project 分類 + 全域 Tag，可跨篇比較 |
| 需要手動下載 PDF 給其他 AI | AI 直接在 Council 裡回答，基於已解析的結構化內容 |

---

## 核心設計決策

| 決策 | 結論 |
|------|------|
| 組織方式 | **混合版**：Project（頂層大主題）+ 全域 Tags（細粒度篩選） |
| 一篇論文可屬多個 Project | ✅ 是（多對多） |
| Tags 作用域 | ✅ 全域（跨 Project 共用） |
| 「所有論文」總覽 | ✅ 需要，是 Library 的入口頁 |

---

## DB Schema 設計

### 新增 Tables

```sql
-- 使用者的研究 Project
CREATE TABLE library_projects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',  -- UI 識別色
  icon        TEXT,                              -- emoji 或 icon key
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全域 Tags（user 層級）
CREATE TABLE library_tags (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Paper ↔ Project 多對多
CREATE TABLE paper_projects (
  paper_id   TEXT NOT NULL REFERENCES reader_papers(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES library_projects(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (paper_id, project_id)
);

-- Paper ↔ Tag 多對多
CREATE TABLE paper_tags (
  paper_id TEXT NOT NULL REFERENCES reader_papers(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (paper_id, tag_id)
);
```

### 現有 reader_papers 維持不變
只需在查詢時 JOIN 上述表格取得 tags 和 projects 資訊。

---

## 頁面架構

```
/library                          ← All Papers 總覽（Library home）
/library/projects/[projectId]     ← 單一 Project 視圖
/reader                           ← 上傳 / 新增入口（現有）
/reader/[paperId]                 ← 單篇閱讀（現有，需加 annotation + 翻譯）
```

---

## API Routes 設計

### Library（新增）
```
GET    /api/library/papers              ← 所有論文（含 tags + projects）
POST   /api/library/papers/:id/tags     ← 加 tag 到論文
DELETE /api/library/papers/:id/tags/:tagId

GET    /api/library/projects            ← 列出所有 projects
POST   /api/library/projects            ← 建立 project
PUT    /api/library/projects/:id        ← 編輯 project
DELETE /api/library/projects/:id        ← 刪除 project
GET    /api/library/projects/:id/papers ← 取某 project 的論文
POST   /api/library/projects/:id/papers ← 把論文加進 project
DELETE /api/library/projects/:id/papers/:paperId

GET    /api/library/tags               ← 列出所有 tags
POST   /api/library/tags               ← 建立 tag
DELETE /api/library/tags/:id           ← 刪除 tag
```

### Reader 補強（現有路徑，新增功能）
```
POST   /api/reader/papers/:id/translate      ← 翻譯整篇（block 級）
GET    /api/reader/papers/:id/annotations    ← 取批注
POST   /api/reader/papers/:id/annotations    ← 新增批注
DELETE /api/reader/papers/:id/annotations/:annotId
```

### AI 分析（新增）
```
POST   /api/ai/compare    ← 傳入 paperIds + dimensions → 比較表
POST   /api/ai/research-map ← 傳入 paperIds → 語義關係圖資料
```

---

## 功能建構順序

### Phase 1 — Library 地基（最優先）

> 沒有這個，所有後續功能都無法組織。

**P1-A：DB schema + 基礎 API**
- [ ] 新增 `library_projects`, `library_tags`, `paper_projects`, `paper_tags` 表
- [ ] `ensureLibrarySchema()` 函式（idempotent）
- [ ] CRUD API routes（projects, tags, 關聯）

**P1-B：Library 首頁 UI（/library）**
- [ ] All Papers 總覽：卡片式 grid，顯示封面/標題/作者/tags
- [ ] 左側：Project 清單 sidebar + 「所有論文」入口
- [ ] 右上：新增 Project 按鈕
- [ ] Tag 篩選列（多選）
- [ ] 搜尋（標題/作者全文搜尋）
- [ ] 排序（新增時間 / 標題 / 作者）

**P1-C：Project 視圖 UI（/library/projects/[projectId]）**
- [ ] 同 All Papers，但只顯示屬於此 Project 的論文
- [ ] Project header（名稱 + 顏色 + icon + 描述）
- [ ] 快速把論文加進 / 移出 Project 的操作

**P1-D：Paper Card 元件**
- [ ] 顯示：標題、作者、tags（彩色 chip）、所屬 projects
- [ ] 操作：加 tag、加入 project、刪除、開啟閱讀
- [ ] 狀態：已批注、已翻譯（badge）

**P1-E：Tag 管理**
- [ ] 新增 tag（名稱 + 顏色選擇）
- [ ] 刪除 tag
- [ ] 在 paper card 上快速打 tag（combobox）

---

### Phase 2 — Reader 補強

**P2-A：翻譯切換**
- [ ] Reader 右上角加「翻譯」切換按鈕（原文 ↔ 中文）
- [ ] 呼叫翻譯 API（用 Gemini，逐 block 翻譯）
- [ ] 翻譯結果快取進 DB（`translation_json` 欄位加到 `reader_papers`）
- [ ] 翻譯時保留數學公式（KaTeX block 不翻）、圖片不動

**P2-B：Annotation（批注）**
- [ ] DB：`paper_annotations` 表（paperId, blockId, sentenceId, text, note, color, createdAt）
- [ ] UI：選取句子 → 彈出顏色選擇器 → 儲存高亮
- [ ] 批注側欄：列出所有筆記
- [ ] 高亮在重新開啟時恢復（從 DB 載入）

---

### Phase 3 — AI 分析功能

**P3-A：Comparison Table（比較表）**
- [ ] 入口：Library 選多篇論文 → 「建立比較表」
- [ ] 設定畫面：輸入比較維度（預設：方法、數據集、結論、優缺點、製程）
- [ ] AI 呼叫：傳入各篇的 contentJson 摘要 + 維度 → 生成 JSON 表格
- [ ] 結果：可排序、可 export CSV 的互動表格
- [ ] 儲存：比較結果存入 DB，可重複查看

**P3-B：Research Map（研究地圖）**
- [ ] 語義相似度：用 Gemini embedding 計算多篇論文的向量距離
- [ ] 引用關係：整合 Semantic Scholar API（arXiv ID → 引用圖）
- [ ] 視覺化：D3.js force-directed graph
  - 節點：論文（大小 = 被引次數）
  - 邊：引用關係（實線）/ 語義相似（虛線）
  - 顏色：按 Project 或 Tag 分色
- [ ] 互動：hover 看摘要、click 進入閱讀

---

### Phase 4 — 未來功能（列入計畫，暫不實作）

- [ ] **Browser Extension**：在 Google Scholar / PubMed 一鍵存入 Library
- [ ] **BibTeX Export**：單篇或批次匯出，用於 Overleaf
- [ ] **Related Work 生成**：選多篇 + 研究題目 → AI 起草 related work 段落
- [ ] **Semantic Scholar 整合**：根據 Library 論文推薦相關文獻

---

## 技術注意事項

### 翻譯策略
- 用 Gemini Flash（快 + 便宜）逐 block 翻譯
- MathBlock、FigureBlock、CaptionBlock 保留原文不翻
- 翻譯存 DB，不重複呼叫 API

### Annotation 策略
- 綁定 `blockId` + `sentenceId`（已有，在 TextBlock.sentences[].id）
- 不用 PDF canvas，直接在 React span 上加 className
- 顏色存 hex，4 種預設色（黃/綠/藍/紅）

### Research Map 依賴
- Semantic Scholar API（免費，有 rate limit）
- Gemini embedding API（`text-embedding-004`）
- D3.js（已考慮引入）

### 現有 reader_papers 相容性
- 不改現有欄位，只新增關聯表
- `listReaderPapers` 需新增版本，JOIN tags + projects

---

## 任務切分（可作為 Issue 清單）

```
[LIB-01] 新增 DB schema（library_projects, library_tags, paper_projects, paper_tags）
[LIB-02] Library API routes — projects CRUD
[LIB-03] Library API routes — tags CRUD + paper 關聯
[LIB-04] Library 首頁 UI /library（All Papers grid + sidebar）
[LIB-05] Project 視圖 UI /library/projects/[id]
[LIB-06] Paper Card 元件（含 tag chip、project badge）
[LIB-07] Tag 管理 UI（combobox 打 tag + 顏色選擇）
[LIB-08] App shell 導航加入 Library 入口

[READ-01] 翻譯切換 — API route + Gemini 呼叫 + DB 快取
[READ-02] 翻譯切換 — Reader UI（切換按鈕 + 翻譯渲染）
[READ-03] Annotation DB schema（paper_annotations）
[READ-04] Annotation UI — 句子高亮操作 + 顏色選擇器
[READ-05] Annotation UI — 批注側欄（筆記清單）
[READ-06] Annotation 持久化（頁面重載後恢復高亮）

[AI-01] Comparison Table — AI API route（傳 contentJson + 維度 → JSON）
[AI-02] Comparison Table — 設定 UI（選論文 + 設定維度）
[AI-03] Comparison Table — 結果 UI（互動表格 + CSV export）
[AI-04] Research Map — Semantic Scholar API 整合
[AI-05] Research Map — Gemini embedding 計算
[AI-06] Research Map — D3.js 視覺化
```

---

## 建議的第一個 Sprint

優先完成 LIB-01 → LIB-03 → LIB-08 → LIB-04 → LIB-06 → LIB-07 → LIB-05

理由：Library 地基建好後，每一個後續功能都有地方「掛」上去。
先做 UI 骨架讓整體流程可以走通，再補 AI 功能。
