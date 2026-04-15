# Council — 產品規格與路線圖

> 最後更新：2026-04-14

---

## 定位

**Council** 是一套針對學術研究者（碩博生 / 博後 / PI / RA）的 AI 多代理研究輔助引擎。  
核心差異：不只是聊天機器人或摘要工具，而是**模擬同行審查委員會**，對論文進行多視角辯論、找缺口、催化研究 idea。

---

## 目標用戶

| 用戶類型 | 主要使用情境 |
|----------|-------------|
| 碩博士生 | 找研究缺口、準備 proposal、寫 related work |
| 博後 / RA | 快速消化大量文獻、找新方向 |
| PI | 評估學生草稿、探索跨領域機會 |
| 審稿人 | 快速生成結構化審查意見 |

---

## 使用者開始前的典型輸入

- 一個研究題目 / 關鍵詞
- 一篇或幾篇 seed paper（arXiv ID / PDF）
- 自己的論文草稿（gap analysis 模式）

---

## A. 定位與使用情境

### ✅ 已實作
- 兩種模式：**Full Critique**（批判現有論文）/ **Gap Analysis**（分析自己的稿子）
- arXiv ID 輸入 + PDF 上傳

### ❌ 待補
- [ ] Landing page 明確寫出目標用戶（碩博生 / 博後 / PI）
- [ ] 拆分情境入口：「探索新題目」「系統性文獻回顧」「寫 related work」「proposal 構思」
- [ ] 明確列出每種模式的產出物與品質標準（coverage、來源可追溯）

---

## B. 文獻發現與資料來源

### ✅ 已實作
- arXiv PDF 抓取（`paper-ingest.ts`）
- PDF 上傳解析（`pdf-parse`）
- RAG 文件庫（向量化段落，供 agents 查詢）

### ❌ 待補
- [ ] **Semantic Scholar API** 整合（依題目/關鍵詞搜尋相關論文）
- [ ] **引用網絡擴展**：從 seed paper 展開 cited-by / references
- [ ] PubMed / bioRxiv 支援
- [ ] 來源類型標籤（peer-reviewed、preprint、grey literature）
- [ ] 語意搜尋介面（以研究問題驅動，非單純關鍵字）
- [ ] 雙層篩選：AI 初篩 → 使用者確認邊界案例
- [ ] 手動 include/exclude 特定 paper 並影響後續分析

---

## C. 跨領域研究地圖與 Idea 催化

### ✅ 已實作
- Gap Analysis 模式：Gap Finder + Related Work Scout 兩個 agent
- 多視角 gap 檢查（gap finder / hostile reviewer / methods auditor）

### ❌ 待補
- [ ] **研究地圖視覺化**：topic map / citation graph（可用 D3 或 react-flow）
- [ ] 從 seed paper 自動展開相關領域與研究線索
- [ ] 明確定義缺口類型：方法未使用 / 族群未研究 / 指標未比較 / 時間點未涵蓋
- [ ] Gap → 可行研究問題生成（含：變項、族群、方法雛型）
- [ ] 新穎性檢查：提供相近已有工作清單，避免重複造輪

---

## D. 文獻理解與結構化

### ✅ 已實作
- 每個 reviewer agent 輸出對論文的深度分析（目的/方法/結果/限制）
- Moderator 綜合所有 agent 意見為結構化 verdict

### ❌ 待補
- [ ] **表格化萃取**：樣本數、族群、變項、測量工具、效應大小（方便多篇比較）
- [ ] AI 摘要 + 原文片段高亮（讓使用者驗證 AI 解讀正確性）
- [ ] 多篇文獻：結果是否一致 / 有哪些矛盾
- [ ] 自動生成主題 / 子主題聚類（把大量文獻分組）
- [ ] 研究品質評分欄位（方法嚴謹度、樣本大小、p-hacking 風險）

---

## E. 來源追溯與可信度控制

### ✅ 已實作
- `CouncilEvidence` 結構有 `source_refs`（label, uri, snippet）
- RAG 查詢只能取自已解析文件（無法幻覺引用）

### ❌ 待補
- [ ] **結果頁 UI**：點擊一句話 → 展開對應原文段落
- [ ] 來源信心度標示（RAG 命中 vs 模型知識 vs 搜尋結果）
- [ ] 「疑似幻覺引用」警示模式

---

## F. 論文寫作輔助

### ✅ 已實作
- Gap Analysis 的 Supportive Mentor 會給具體修改建議
- 整體定位為「輔助分析」而非代寫

### ❌ 待補（選做 / 下一階段）
- [ ] Related work 章節結構生成（subheading 提案 + 每段論點）
- [ ] 段落層級寫作回饋（清楚度 / 邏輯 / 銜接）
- [ ] 學術語氣調整建議
- [ ] 格式 / citation style 建議（APA / IEEE / Vancouver）
- [ ] 「解釋優先」模式：說明為什麼這樣改，而非只給修改後文本

---

## G. 使用流程與 UX

### ✅ 已實作
- 清楚的三步驟：輸入論文 → 選模式 → 看結果
- 串流輸出（SSE），即時顯示各 reviewer 進度

### ❌ 待補
- [ ] **專案概念**：同一研究題目下的所有分析集中管理
- [ ] Save & resume：可回顧歷史分析記錄
- [ ] 結果頁：表格 / 面板視圖（目前只有串流文字）
- [ ] 探索模式（廣）vs 收斂模式（整理 / 寫作）明確切換
- [ ] 手機友好的 responsive 設計

---

## H. 學術倫理

### ✅ 已實作
- 工具性質：分析輔助，非代寫
- 所有輸出來自解析文件，非自由生成引用

### ❌ 待補
- [ ] UI 明確顯示「AI 輔助分析，最終判斷由使用者負責」
- [ ] 可配置 AI 介入程度（僅整理 / 給大綱建議 / 給段落建議）

---

## I. 技術架構

### ✅ 已實作
- 多代理辯論引擎（`council.ts`）
- 各 agent 角色分工：Methods Critic / Literature Auditor / Replication Skeptic / Contribution Evaluator / Constructive Advocate / Gap Finder / Hostile Reviewer / Methods Auditor / Related Work Scout / Supportive Mentor
- 模型可配置（Codex / Claude Haiku / Sonnet / Opus）
- Agentic runtime（RAG + web search + fetch）
- Divergence check → Round 2 觸發機制

### ❌ 待補
- [ ] 任務導向評估框架（在 benchmark 上測 coverage / gap 品質）
- [ ] 使用者回饋機制（like/dislike / 人工修改）用來迭代 agent 策略
- [ ] Semantic Scholar / PubMed agent（文獻搜尋專責）

---

## 優先級排序（建議）

| 優先 | 項目 | 理由 |
|------|------|------|
| P0 | 來源點擊展開原文（E） | 核心信任機制，差異化賣點 |
| P0 | Landing page 明確用戶定位（A） | 影響轉換率 |
| P1 | Semantic Scholar 整合（B） | 讓工具能主動找文獻，不只分析 |
| P1 | 表格化萃取多篇文獻（D） | 研究者最需要的比較功能 |
| P1 | 專案 / 歷史記錄（G） | 留存率 |
| P2 | 研究地圖視覺化（C） | 差異化 wow factor |
| P2 | Related work 結構生成（F） | 高價值寫作輔助 |
| P3 | 評估框架 + 用戶回饋（I） | 產品迭代基礎設施 |

---

## 現有 API

| Endpoint | 功能 |
|----------|------|
| `POST /api/papers/ingest` | 解析 arXiv/PDF 進 RAG |
| `POST /api/council` | 建立審查 session |
| `GET /api/council/:id/run` | SSE 串流辯論 |
| `POST /api/keys` | 建 Free API key |
| `POST /api/stripe/checkout` | 建 Stripe Checkout（Pro） |
| `POST /api/stripe/webhook` | 付款完成 → 升級 key |
| `GET /api/stripe/session` | Success page 取 key |
| `POST /api/v1/analyze` | 外部 API（帶 key 驗證） |
