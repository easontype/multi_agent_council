# Council SaaS — 產品改造計畫書

**版本：** 0.4 | **更新：** 2026-05-09

---

## 一、產品定位

**目標用戶：** 學術研究者（材料、生醫、物理、通用），在撰稿、投稿、會議前需要快速模擬同行評審壓力、找出論文弱點、備齊文獻答案，以及比較方案優劣。

**核心價值主張：**
> 丟進一篇 paper，5 個從不同角度攻擊你的 AI reviewer 幫你找出教授一定會問的問題，並從外部文獻找到答案。  
> 或者，讓兩個 AI 陣營為「MXene vs Graphene」辯論，給你一份有根據的裁決。

**主要輸出物：**
- 可互動的辯論逐字稿（Timeline / Compare / Map）
- 結構化「meeting 前準備報告」（Markdown export）
- Adversarial 辯論裁決（winning_team + 論據摘要）

---

## 二、完成狀態總覽

### 後端核心（全部完成）

| 項目 | 狀態 | Phase |
|---|---|---|
| 4 套域席位定義（General / Materials / Biomedical / Physics） | ✅ | 1 |
| DebateStrategy 抽象層（critique / adversarial 兩種模式） | ✅ | 3 |
| Adversarial 鏡像辯論（team 欄位 + interleaved Round 2） | ✅ | 3 |
| Adversarial Moderator（winning_team 判決） | ✅ | 3 |
| Position tracking（position_changed / position_change_reason） | ✅ | 3 |
| Editorial Decision（Accept / Minor / Major / Reject）+ Questions | ✅ | 2 |
| Meeting 前準備報告 Export 格式 | ✅ | 2 |
| DB migration（所有新欄位） | ✅ | 1–3 |

### 前端 UI（全部完成）

| 項目 | 狀態 | Phase |
|---|---|---|
| `/review/new` Step 0 域選擇（4 個 radio card） | ✅ | 4A |
| `buildDomainTeam()` — 根據域初始化席位 | ✅ | 4A |
| Team Setup 顯示域 badge | ✅ | 4A |
| `/debate/new` 4 步驟 wizard | ✅ | 4B |
| Adversarial 鏡像席位預覽（A隊 / B隊 / Moderator） | ✅ | 4B |
| 主頁「Compare & Debate」entry card | ✅ | 4B |
| Timeline / Compare / Map 辯論 UI | ✅ | — |
| Session restore / resume / rerun / duplicate-as-new | ✅ | — |
| Evidence citations + source panel | ✅ | — |
| Dashboard / reviews list / share / export | ✅ | — |

### 骨架健全（不動）

- PDF / arXiv ingestion pipeline（text → RAG chunking → embedding）
- search_papers / web_search 外部文獻搜尋
- SSE streaming 辯論串流
- Markdown export 端點（`/api/sessions/[id]/export`）

---

## 三、架構說明

### 兩種辯論模式

| 模式 | 說明 | 入口 |
|---|---|---|
| **critique**（預設） | 所有席位從不同角度攻擊同一對象 | `/review/new` |
| **adversarial** | 席位分兩陣營互相辯論 | `/debate/new` |

### Domain → Seats 對應

| Domain | Seats | 典型場景 |
|---|---|---|
| `general` | Methods Critic、Literature Auditor、Replication Skeptic、Contribution Evaluator、Constructive Advocate | 通用論文審查 |
| `materials` | Material Rationalist、Characterization Auditor、Performance Benchmarker、Synthesis Skeptic、Commercial Assessor | 材料科學 |
| `biomedical` | Safety Examiner、Translational Skeptic、Regulatory Analyst、Competing Therapy Auditor、Clinical Benchmarker | 生醫 / 藥物 |
| `physics` | Device Integrator、Efficiency Auditor、Fabrication Skeptic、Reliability Examiner、System Benchmarker | 物理元件 |

### Adversarial 席位結構

```typescript
// buildAdversarialTeam(config) 產生：
[
  { role: "Material Rationalist [MXene]", team: "option_a", systemPrompt: "你支持 MXene..." },
  { role: "Synthesis Skeptic [MXene]",   team: "option_a", systemPrompt: "..." },
  { role: "Material Rationalist [Graphene]", team: "option_b", systemPrompt: "你支持 Graphene..." },
  { role: "Synthesis Skeptic [Graphene]",    team: "option_b", systemPrompt: "..." },
  { role: "Moderator", team: "moderator", systemPrompt: "中立裁決..." },
]
```

---

## 四、執行序列

```
✅ Phase 1 — 席位定義（4 套域 + council-academic.ts）
✅ Phase 2 — 報告格式（Meeting 前準備報告 Export）
✅ Phase 3 — 品質修補 + DebateStrategy 重構 + Adversarial 後端
✅ Phase 4A — Critique 域選擇 UI（/review/new Step 0）
✅ Phase 4B — Adversarial 辯論建立流程（/debate/new wizard）
→  Phase 5 — 待規劃
```

| Phase | 狀態 | 說明 |
|---|---|---|
| 1 | ✅ 完成 | 席位定義、heuristic 分類器 |
| 2 | ✅ 完成 | Editorial Decision、Meeting 報告 Export |
| 3 | ✅ 完成 | DebateStrategy、Adversarial 模式、Position tracking |
| 4A | ✅ 完成 | 域選擇 UI、buildDomainTeam |
| 4B | ✅ 完成 | /debate/new wizard、buildAdversarialTeam |
| 5 | 待規劃 | 見下方 |

---

## 五、下一步（Phase 5 候選）

**P0 — 穩定性**

| 項目 | 說明 |
|---|---|
| Background embedding pipeline | 目前 ingestion 阻塞 request path，第一次 ingest 慢 30–60s |
| Gemini 503 retry/fallback | 目前直接顯示 error banner，應能自動重試 |

**P1 — 產品功能**

| 項目 | 說明 |
|---|---|
| Debate 結果頁優化 | Adversarial session 的 winning_team 高亮呈現 |
| 角色自訂 system prompt（Debate 版） | 目前 debate wizard 不支援手動調整 prompt |
| Semantic Scholar 搜尋整合 | search_papers tool 升級 |
| 多論文比較表 | paper-compare-table.tsx 已有骨架 |

**P2 — 基礎建設**

| 項目 | 說明 |
|---|---|
| Paper asset canonical model | `paper_assets / libraries / library_documents` 正式化 |
| Background job（非 SSE 生命週期） | 將辯論從 frontend-owned SSE 遷移至 worker |
| Billing entitlement model | 目前 quota 邏輯分散在多處 |

**P3 — i18n**

| 項目 | 說明 |
|---|---|
| UI 全面多語言（next-intl） | 目前 agent output 可多語，UI label 仍英文 |

---

## 六、暫緩項目（刻意延後）

| 項目 | 原因 |
|---|---|
| Evidence weighting 品質評分 | 需額外 LLM call，成本高，MVP 後再做 |
| 超過 3 個角色的鏡像（>6 席） | 成本控制，有需求再開放 |
| Adversarial Round 3+（多輪對決） | 2 輪已足夠 |
| 報告 PDF 匯出 | Markdown 目前足夠 |

---

*計畫書由 Claude Code 協助產出，基於 2026-05-09 codebase 狀態。*
