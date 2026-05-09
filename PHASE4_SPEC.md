# Phase 4 實作規格書

**版本：** 1.0 | **建立：** 2026-05-09

---

## 概覽

Phase 4 分兩條線平行推進：

| Phase | 功能 | 入口 | 優先級 |
|---|---|---|---|
| 4A | Critique 域選擇 | `/review/new`（改） | P2 |
| 4B | Adversarial 辯論建立流程 | `/debate/new`（新） | P2 |

兩條線共用同一套後端（orchestrator、DB、export），後端**零改動**。

---

## Phase 4A — Critique 域選擇

### 目標

在現有 `/review/new` 流程的最前面加入「選擇研究域」步驟，  
讓系統自動帶入對應席位，取代目前的通用席位。

### 現狀

`/review/new/page.tsx` → `<ReviewSurface mode="draft" />`  
域選擇邏輯目前不存在，用戶一律使用 `CRITIQUE_SEAT_DEFINITIONS`（5 個通用席位）。

`council-academic.ts` 已有：
- `CRITIQUE_SEAT_DEFINITIONS` — 通用
- `EXPERIMENTAL_SEAT_DEFINITIONS` — 實驗科學通用
- `BIOMEDICAL_SEAT_DEFINITIONS` — 生醫
- `PHYSICS_SEAT_DEFINITIONS` — 物理/元件

### 新增步驟

```
Step 0（新）：選擇研究域
  ○ General Academic       → CRITIQUE_SEAT_DEFINITIONS
  ○ Materials & Chemistry  → EXPERIMENTAL_SEAT_DEFINITIONS
  ○ Biomedical & Life Sci  → BIOMEDICAL_SEAT_DEFINITIONS
  ○ Physics & Devices      → PHYSICS_SEAT_DEFINITIONS

  → 選完後自動帶入對應席位，進入原有的 Team Setup 步驟
  → 仍可在 Team Setup 手動調整各席位 system prompt
```

### 涉及檔案

| 檔案 | 改動 |
|---|---|
| `src/lib/prompts/review-presets.ts` | 新增 `buildDomainTeam(domain: ReviewDomain): EditableReviewAgent[]`，根據域回傳對應席位陣列 |
| `src/components/review/review-surface.tsx` | 加入 Step 0 domain picker UI（radio card 選擇），選完後呼叫 `buildDomainTeam()` 初始化 agents |
| `src/components/council/review-setup/review-setup-panel.tsx` | 顯示目前選擇的域名稱 + badge |

### 新增型別

```typescript
// review-presets.ts
export type ReviewDomain = 'general' | 'materials' | 'biomedical' | 'physics'

export function buildDomainTeam(domain: ReviewDomain): EditableReviewAgent[]
```

---

## Phase 4B — Adversarial 辯論建立流程

### 目標

建立獨立的 `/debate/new` 頁面，支援「上傳 PDF → 輸入 X vs Y → 選角色 → 鏡像席位 → 開始辯論」完整流程。

### 核心設計：鏡像席位（Mirror Teams）

每個選擇的角色複製兩份，一份支持 Option A，一份支持 Option B。

```
用戶選擇域：materials
用戶選角色：Material Rationalist + Synthesis Skeptic
用戶輸入：MXene vs Graphene

→ 產生 4 席位：
  A隊：Material Rationalist（支持 MXene）+ Synthesis Skeptic（支持 MXene）
  B隊：Material Rationalist（支持 Graphene）+ Synthesis Skeptic（支持 Graphene）
  + 1 Moderator（中立）
```

### 頁面流程（`/debate/new`）

```
Step 1：上傳論文
  - PDF 上傳 或 arXiv URL（復用現有 PDF ingestion component）
  - 論文提供辯論的「證據基礎」，agents 從中找支撐點

Step 2：輸入辯論主題
  ┌─────────────────────────────────────────┐
  │  比較  [ MXene       ] vs [ Graphene   ] │
  │                                         │
  │  背景說明（可選）                         │
  │  [ 用於柔性感測器電極材料選擇...         ] │
  └─────────────────────────────────────────┘

Step 3：選擇研究域
  ○ Materials & Chemistry
  ○ Biomedical & Life Sciences
  ○ Physics & Devices
  ○ General Academic

Step 4：選擇辯論角度（選 2–3 個）
  顯示該域的所有角色，附簡短說明
  ☑ Material Rationalist — 材料選擇合理性
  ☑ Synthesis Skeptic    — 合成可重現性
  ☐ Performance Benchmarker
  ☐ Commercial Assessor
  ☐ Characterization Auditor

  預覽：
  ┌────────────────────────────────┐
  │ 4 席位 + 1 Moderator           │
  │ A隊（MXene）：2 席             │
  │ B隊（Graphene）：2 席          │
  └────────────────────────────────┘

Step 5：開始辯論 →
```

### 新增後端 Helper

唯一需要新增的後端邏輯：

```typescript
// src/lib/prompts/debate-presets.ts（新檔案）

export interface AdversarialDebateConfig {
  optionA: string           // "MXene"
  optionB: string           // "Graphene"
  context?: string          // 可選背景說明
  domain: ReviewDomain      // 'materials' | 'biomedical' | 'physics' | 'general'
  selectedRoleIds: string[] // ["material", "synthesis"]
}

export function buildAdversarialTeam(config: AdversarialDebateConfig): CouncilSeat[]
// 回傳帶 team: "option_a" | "option_b" 的席位陣列
// 直接傳入現有 createCouncilSession({ debate_mode: "adversarial", seats: [...] })
```

System prompt 模板（每個鏡像席位）：

```
你是 {roleName}，在這場辯論中你的立場是支持「{optionA}」。

背景：{context ?? "比較兩種選項的優劣"}

你的分析框架：{原始 role 的 systemPrompt}

重要：從論文內容和外部文獻中尋找支持「{optionA}」的論據。
當對方提出反駁時，直接針對其論點回應。
```

### 涉及檔案

| 檔案 | 改動 |
|---|---|
| `src/lib/prompts/debate-presets.ts` | **新建**：`buildAdversarialTeam()` + `AdversarialDebateConfig` 型別 |
| `src/app/debate/new/page.tsx` | **新建**：4-step wizard 頁面 |
| `src/app/debate/new/layout.tsx` | **新建**（可選）：共用 layout |
| `src/components/debate/debate-setup/` | **新建目錄**：debate-setup-panel.tsx、role-selector.tsx、topic-input.tsx |
| `src/app/page.tsx`（主頁） | 加入「Compare & Debate」entry card，連結到 `/debate/new` |

### 復用現有元件

| 需求 | 復用來源 |
|---|---|
| PDF 上傳 / arXiv 輸入 | 從 ReviewSurface 提取或直接引用現有 upload component |
| Domain picker UI | 與 4A 共用同一個 domain picker component |
| Agent 預覽卡片 | `src/components/council/review-setup/agent-card.tsx` |
| Session 建立 API | `POST /api/sessions`（不動） |

---

## 執行序列

```
Phase 4A（域選擇）  ←── 先做，較簡單，熟悉 review-surface 結構
      ↓
Phase 4B Step 1：  建立 debate-presets.ts（buildAdversarialTeam）
      ↓
Phase 4B Step 2：  建立 /debate/new 頁面（4-step wizard）
      ↓
Phase 4B Step 3：  主頁加 entry card
```

### 工作量估計

| 任務 | 估計 |
|---|---|
| 4A：domain picker + buildDomainTeam | 小（~2 檔案，~100 行） |
| 4B：buildAdversarialTeam helper | 小（~1 檔案，~80 行） |
| 4B：/debate/new wizard UI | 中（~4 檔案，~300 行） |
| 4B：主頁 entry card | 小（~10 行） |

後端改動量：**零**。

---

## 不在此 Phase 範圍內

- Adversarial session 的辯論 UI（結果頁）— 復用現有 Timeline / Compare / Map，無需改動
- Export 格式調整 — 現有 export 已支援 adversarial，暫不動
- 角色自訂 system prompt 編輯（debate 版）— v2 再加
- 超過 3 個角色的鏡像（>6 席）— 刻意限制，成本控制

---

*規格書由 Claude Code 產出，基於 2026-05-09 codebase 狀態。*
