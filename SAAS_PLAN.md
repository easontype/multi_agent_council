# Council SaaS — 產品改造計畫書

**版本：** 0.3 | **更新：** 2026-05-07

---

## 一、產品定位

**目標用戶：** 實驗科學研究者（材料、生醫、物理），在撰稿、投稿、meeting 前需要快速模擬同行評審壓力、找出論文弱點、備齊文獻答案。

**核心價值主張：**
> 丟進一篇 paper，5 個從不同角度攻擊你的 AI reviewer 幫你找出教授一定會問的問題，並從外部文獻找到答案。

**輸出物：**
- 可互動的辯論逐字稿（Timeline / Compare / Map）
- 一份結構化的「meeting 前準備報告」（Markdown export）

---

## 二、現狀盤點

### 已完成（2026-05-07）

| 項目 | 狀態 |
|---|---|
| `experimental` template 型別加入 council-types.ts | ✅ |
| 5 個通用實驗席位定義（council-academic.ts） | ✅ |
| 實驗向 Round 1 / 2 專屬 prompt 格式 | ✅ |
| Session orchestrator 自動偵測 experimental template | ✅ |
| 實驗關鍵字 heuristic 分類器 | ✅ |
| LLM 分類器支援 experimental | ✅ |
| **`materials` template — Material Rationalist、Characterization Auditor、Performance Benchmarker、Synthesis Skeptic、Commercial Assessor** | ✅ |
| **`biomedical` template — Safety Examiner、Translational Skeptic、Regulatory Analyst、Competing Therapy Auditor、Clinical Benchmarker** | ✅ |
| **`physics` template — Device Integrator、Efficiency Auditor、Fabrication Skeptic、Reliability Examiner、System Benchmarker** | ✅ |
| **Heuristic 分類器加入 materials / biomedical / physics 關鍵字組** | ✅ |
| **LLM 分類器支援 8 個 template** | ✅ |
| **Round 2 字數放寬（experimental 400w、general 300w、normalizer 400 hard cap）** | ✅ |
| **CouncilTurn 加 position_changed / position_change_reason 欄位** | ✅ |
| **council-turn-normalizer 解析 Stance 段落寫入 position_changed** | ✅ |
| **DebateStrategy 抽象層（debate-strategy.ts）** | ✅ |
| **Adversarial 辯論模式（debate_mode + team 欄位）** | ✅ |
| **Adversarial Interleaved Round 2（A₁→B₁→A₂→B₂）** | ✅ |
| **Adversarial Moderator（winning_team 判決）** | ✅ |
| **DB migration（debate_mode、winning_team、position_changed 欄位）** | ✅ |
| **Phase 2：Editorial Decision（Accept/Minor/Major/Reject）欄位** | ✅ |
| **Phase 2：Questions to Prepare（raised_by、literature、suggestion）** | ✅ |
| **Phase 2：DissentItem 加入 resolution_path** | ✅ |
| **Phase 2：Moderator system prompt 加入 editorial decision 規則** | ✅ |
| **Phase 2：Export route 重寫為「Meeting 前準備報告」格式** | ✅ |
| **Phase 2：DB migration（editorial_decision、editorial_rationale、questions 欄位）** | ✅ |

### 骨架健全（不動）

- PDF / arXiv 論文 ingestion pipeline（text extraction → RAG chunking → embedding）
- 兩輪辯論 + Moderator 統整
- search_papers / web_search 外部文獻搜尋
- Markdown export 端點（`/api/sessions/[id]/export`）
- Timeline / Compare / Map UI

---

## 三、辯論架構說明

### 兩種模式

| 模式 | 說明 | 適用場景 |
|---|---|---|
| **critique**（預設） | 所有席位從不同角度攻擊同一個對象 | 論文審查、方案評估 |
| **adversarial** | 席位分兩陣營，互相辯論 | 方案 A vs B、材料比較、是否採用 X |

### DebateStrategy 架構

```
createCouncilSession({ debate_mode: "critique" | "adversarial", seats: [...] })
         ↓
selectDebateStrategy(session)
  ├── "adversarial"      → AdversarialStrategy
  └── "critique"         → CritiqueStrategy(isScientific)
         ↓
Round 1：全席位並行（prompt 內容依模式而異）
Round 2：
  critique   → sequential（每席看完前人再說）
  adversarial → interleaved（A₁→B₁→A₂→B₂，即時看到對方反駁）
Moderator：
  critique   → consensus + dissent
  adversarial → winning_team + dissent
```

### Adversarial 席位設定方式

```typescript
seats: [
  { role: "...", team: "option_a", systemPrompt: "你支持 MXene..." },
  { role: "...", team: "option_a", systemPrompt: "..." },
  { role: "...", team: "option_b", systemPrompt: "你支持 Graphene..." },
  { role: "...", team: "option_b", systemPrompt: "..." },
]
```

---

## 四、待完成工作

---

### ~~Phase 2｜報告輸出格式重設計~~ ✅ 完成
**優先級：P0 — 直接影響用戶拿到什麼**

**現狀問題：** export 是「辯論逐字稿 + JSON 結論」，研究者讀完不知道自己該做什麼。

**目標輸出格式：**

```markdown
# Council Review：[論文標題]

## 編輯建議
**建議：** Major Revision
**理由：** 特異性 claim 缺乏對照組實驗支撐；無與商用感測器的定量比較。

## Meeting 前需要準備的答案

### 問題 1：為什麼選這個材料而非替代方案？
**提問席位：** Material Rationalist
**文獻依據：** [論文A 2024] 顯示 MXene 在相同條件下 selectivity coefficient = 0.92，
               本文未提供此對比數據。
**建議補充：** 加入選擇性實驗，至少對比 2 種替代材料。

## 未解決分歧

### 分歧：合成可重現性
| 席位 | 立場 |
|---|---|
| Synthesis Skeptic | 前驅物純度未指定，無法重現 |
| Constructive Advocate | 方法已足夠，需補充供應商資訊 |

**解決路徑：** 補充前驅物規格 + 批次一致性數據
```

**涉及改動：**

| 檔案 | 改動 |
|---|---|
| `src/lib/core/council-types.ts` | `CouncilConclusion` 加入 `editorial_decision`、`editorial_rationale` 欄位；`DissentItem` 加入 `resolution_path` 欄位 |
| `src/lib/prompts/council-prompts.ts` | Moderator system prompt 加入 editorial decision 指引；要求每個 dissent 附解決路徑 |
| `src/app/api/sessions/[id]/export/route.ts` | 重寫報告 template，改為「問題清單 + 文獻答案」格式 |

---

### Phase 4｜UI 域選擇 + Adversarial 建立流程
**優先級：P2 — 程式碼正確後再動前端**

#### 4A — Critique 域選擇（原 Phase 4）

在 `/review/new` 加入域選擇步驟：

```
Step 0（新）：選擇你的研究領域
  ○ Materials & Chemistry
  ○ Biomedical & Life Sciences
  ○ Physics & Devices
  ○ General Academic（舊流程）

  → 自動帶入對應席位組合
  → 仍可在 Team Setup 手動調整各席位
```

**涉及改動：**

| 檔案 | 改動 |
|---|---|
| `src/lib/prompts/review-presets.ts` | 新增 `buildDomainTeam(domain)` 函式對應三套席位 |
| `src/app/review/new/page.tsx` | 加入 domain picker step（Step 0） |
| `src/components/council/review-setup/review-setup-panel.tsx` | 顯示目前選擇的域 + 席位角色說明 |

#### 4B — Adversarial 建立流程（新）

需要設計：如何讓使用者建立 adversarial session？

待討論：
- 入口：在現有 `/review/new` 加 tab？還是獨立 `/debate/new`？
- 席位設定：自動分配 A/B 兩隊，還是讓使用者手動設定各席位立場？
- 題目格式：「X vs Y」自動拆兩隊，還是讓使用者自由輸入？

---

## 五、執行序列

```
✅ Phase 1（席位定義）
✅ Phase 3（品質修補 + 重構 + adversarial 模式）
✅ Phase 2（報告格式）
→  Phase 4（UI）
```

| Phase | 狀態 | 主要檔案數量 |
|---|---|---|
| 1 — 席位定義 | ✅ 完成 | — |
| 2 — 報告格式 | ✅ 完成 | — |
| 3 — 品質修補 + 重構 | ✅ 完成 | — |
| 4 — UI 流程 | 待做 | 3+ |

---

## 六、暫緩項目（v2）

| 項目 | 原因 |
|---|---|
| Evidence weighting 品質評分 | 需額外 LLM call，成本高，MVP 後再做 |
| 用戶自訂席位保存為 preset | 非核心功能 |
| 報告 PDF 匯出 | 目前 Markdown 已足夠，有需求再加 |
| 多語言席位名稱 UI 顯示 | 低優先 |
| Adversarial Round 3+（多輪對決） | 目前 2 輪已足夠，有需求再擴展 |

---

*計畫書由 Claude Code 協助產出，基於 2026-05-07 當日的 codebase 狀態。*
