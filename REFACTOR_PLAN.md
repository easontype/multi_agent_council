# Council — 架構重構計畫

Updated: 2026-05-01

---

## 整體架構評分

| 面向 | 分數 | 說明 |
|------|------|------|
| DB 層隔離 | 8/10 | 分離乾淨，但 `sanitizeText` 等 utils 混進 db/ |
| 型別系統 | 4/10 | UI 與 DB 各自一套，靠 hydrator 手動轉換 |
| Core 引擎 | 4/10 | 904 行單一檔案，職責混雜 |
| Prompt 管理 | 5/10 | 4 個檔案交叉定義，seat 定義散落 3 處 |
| 前端 State | 5/10 | event dispatch 248 行直接寫死在 React hook |
| API Routes | 7/10 | 結構一致，auth/access 集中，error context 弱 |
| 元件層 | 7/10 | 大多只負責 render，耦合低 |
| 測試覆蓋 | 3/10 | 核心 normalizer/prompts 幾乎無 unit test |
| **總分** | **5.4 / 10** | 可用但有明顯技術債，現階段還不影響功能 |

---

## 問題清單（按嚴重度）

### Critical

無。系統目前可正常運作，沒有崩潰性設計缺陷。

---

### High — 必須修

#### H1：型別系統雙軌並行
**問題**：`src/types/council.ts`（UI 型別）與 `src/lib/core/council-types.ts`（DB 型別）各自定義相同實體：

| UI 型別 | DB 型別 | 轉換成本 |
|---------|---------|---------|
| `DiscussionSession` | `CouncilSession` | hydrator 100+ 行 |
| `AgentMessage` | `CouncilTurn` | 逐欄位手動映射 |
| `SourceRef` | `CouncilEvidenceSource` | 幾乎一模一樣 |
| `Agent` (UI) | `CouncilSeat` + `EditableReviewAgent` | 三種並存 |

**影響**：新增欄位要改 3 處；hydrator 是架構債的累積點。

**涉及檔案**：
- `src/types/council.ts` — 96 行，全部 UI 型別
- `src/lib/core/council-types.ts` — 200+ 行，DB 型別
- `src/lib/services/council-session-hydrator.ts` — 209 行，手動轉換
- `src/types/agent.ts` — 70 行，AgentDB / AgentUI 又是另一套

---

#### H2：Core 引擎 `council.ts` 職責過多
**問題**：904 行，混合以下職責：
- Session 生命週期管理（載入、啟動、恢復、收尾）
- 並發排程（`runWithConcurrency`）
- Turn 執行（`runSeatTurn` — 120 行）
- 引用確保（`ensureTurnCitesEvidence`, `formatEvidenceCitation`）
- Moderator 合成（`runModeratorTurn` — 100+ 行）
- Divergence 分類（`classifyDivergence`）
- Heartbeat 管理（散落 `touchHeartbeat()` 呼叫）

**涉及檔案**：
- `src/lib/core/council.ts` — 904 行 ← 主要重構目標

---

#### H3：Prompt 定義散落 4 個檔案
**問題**：相同 seat 角色（如 Methods Critic）的 system prompt 在不同地方有不同版本：

| 定義位置 | 用途 |
|---------|------|
| `council-academic.ts` | `buildAcademicCritiqueSeats()` / `buildGapAnalysisSeats()` |
| `review-presets.ts` | `buildEditableTeam()` 用的 meta + preset |
| `review-presets.ts` | TeamBuilder 生成的動態 prompt |
| `council-prompts.ts` | `buildSeatRuntimePrompt()` 加注 bias / council context |

**涉及檔案**：
- `src/lib/prompts/council-prompts.ts` — 767 行
- `src/lib/prompts/council-bounded-prompts.ts` — 42 行（只是 thin wrapper，可合併）
- `src/lib/prompts/review-presets.ts` — 602 行
- `src/lib/core/council-academic.ts` — 186 行

---

### Medium — 應該修

#### M1：`use-council-review.ts` 的 event dispatch 硬耦合 React
**問題**：`handleEvent` 函式 248 行，全部是 `if (type === '...')` 分支直接呼叫 `setSession`，無法在 React 外測試。

**涉及檔案**：
- `src/hooks/use-council-review.ts` — 502 行

---

#### M2：Utility 函式誤放 db 層
**問題**：`sanitizeText`, `clamp` 定義在 `council-db.ts`，但被 `council.ts`、`council-prompts.ts`、`council-access.ts` 等非 DB 檔案 import。

**涉及檔案**：
- `src/lib/db/council-db.ts` — 468 行（含 utils）
- 4 個 importer 需更新 import path

---

#### M3：`page.tsx` 14+ 個 useState 混在一起
**問題**：`/analyze/page.tsx` 413 行同時管理 session 狀態、file upload、template、PDF URL、sidebar、cost 等，職責太雜。

**涉及檔案**：
- `src/app/analyze/page.tsx` — 413 行

---

#### M4：Turn normalizer 無測試
**問題**：`council-turn-normalizer.ts` 179 行，含複雜 regex 和 word-budget 演算法，但沒有對應的 unit test。

**涉及檔案**：
- `src/lib/prompts/council-turn-normalizer.ts` — 179 行

---

### Low — 有空再修

#### L1：Agent type 四種並存
`AgentDB`, `AgentUI`, `EditableReviewAgent`, `CouncilSeat` 代表同一概念但用途略異，轉換路徑複雜。

#### L2：Row mapper 中的不安全型別轉換
`council-db.ts` 多處 `as CouncilSessionStatus` 硬轉，可能靜默失敗。

#### L3：API route 錯誤只回傳給前端，沒有 server-side log context
Route handler 的 catch 只做 `return NextResponse.json({ error })`, 缺少 server-side 錯誤上下文。

#### L4：`council-bounded-prompts.ts` 只是 42 行的 thin wrapper
可以直接合併回 `council-prompts.ts`，不值得單獨一個檔案。

---

## 重構路線圖（建議順序）

```
Phase 1 — 基礎清理（低風險，不動邏輯）
  ├── L4：合併 council-bounded-prompts.ts 進 council-prompts.ts
  ├── M2：把 sanitizeText/clamp 移到 lib/utils/text.ts
  └── M4：補 council-turn-normalizer.ts 的 unit tests

Phase 2 — Prompt 整合（中風險）
  ├── H3：建立統一 SeatRegistry，讓 council-academic.ts 和 review-presets.ts 共享同一份 seat 定義
  └── 整理 council-prompts.ts 移除重複的 LEGACY_MODERATOR_SYSTEM_PROMPT

Phase 3 — Core 引擎拆分（高風險，需完整測試保護）
  ├── H2：從 council.ts 抽出：
  │   ├── session-orchestrator.ts  — runCouncilSession 主流程
  │   ├── turn-executor.ts         — runSeatTurn 執行邏輯
  │   ├── moderator-runner.ts      — runModeratorTurn
  │   └── divergence-classifier.ts — classifyDivergence
  └── council.ts 變成薄 façade，只 re-export 公開 API

Phase 4 — 型別統一（高風險，牽涉廣）
  ├── H1：決策：DB 型別加 view projection，或前端 type 直接用 DB 型別
  ├── 縮減 council-session-hydrator.ts 到 < 50 行
  └── 合併 SourceRef 和 CouncilEvidenceSource

Phase 5 — State 重構（影響 UI，需手動驗證）
  └── M1：從 use-council-review.ts 抽出純函式 reducer
       (event, prevState) → newState
       可在 Node 測試，hook 只做 useReducer + side effects
```

---

## 不需要重構的部分

- **LLM adapter 層**（`lib/llm/`）— 抽象乾淨，各 provider 獨立
- **DB schema**（`council-db.ts` 的 DDL 部分）— 結構合理
- **API route handler 結構**（auth、access control 集中）
- **UI 元件**（大多只做 render，耦合低）
- **工具 schema 定義**（`lib/tools/`）— 分類清楚

---

## 風險評估

| Phase | 風險 | 原因 |
|-------|------|------|
| 1 | 低 | 只移動檔案和 import path |
| 2 | 中 | Prompt 邏輯改變可能影響 agent 輸出品質 |
| 3 | 高 | 核心引擎拆分，任何疏漏都會導致辯論流程中斷 |
| 4 | 高 | 型別變更牽涉 20+ 個檔案，hydration 邏輯複雜 |
| 5 | 中 | React state 重構需要手動測試所有 UI 路徑 |

**建議**：Phase 3-4 前必須先建立 E2E 測試保護（完整辯論流程 + Moderator 合成）。

---

## 現狀結論

系統目前「可用但難以維護」。在 Phase 1-2 之前可以安全地繼續加功能。但 Phase 3（core 拆分）拖越久越難做——`council.ts` 每次加功能都在加重這個檔案的負擔。

建議先做 Phase 1（1-2 天），再決定是否立刻進入 Phase 3，還是先繼續加功能。
