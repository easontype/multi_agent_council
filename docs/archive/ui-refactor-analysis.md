# 辯論 / 審查頁面 UI 重構分析

> 建立日期：2026-05-18
> 範圍：`/debate/[id]` 和 `/review/[id]`（共用 `SessionWorkspaceLayout`）

---

## 頁面結構

```
┌─────────────────────────────────────────┐
│            TOP BAR（全寬）               │
├──────────────────────┬──────────────────┤
│   DEBATE CANVAS      │  WORKSPACE RAIL  │
│   （左，1.65fr）      │  （右，0.95fr）  │
└──────────────────────┴──────────────────┘
```

---

## 所有功能完整清單

### 主畫面（Debate Canvas）— 4 個視圖

| # | 功能 | 說明 |
|---|------|------|
| 1 | **Timeline（對話串）** | 依 Round 顯示每個 agent 的完整發言，含 Moderator 結論置頂 |
| 2 | **Compare（跨 agent 比較表）** | 按維度（Position / Assumptions / Risks / Evidence）橫向比較各席位，支援選擇 2 位 agent 比對，Evidence 可點擊來源 |
| 3 | **Flow / DebateMap（挑戰圖）** | Round 2 的 SVG 圖形，節點 = agent，箭頭 = 誰挑戰誰，顯示立場是否改變，可點擊看挑戰內容 |
| 4 | **Gap Map（引用覆蓋熱圖）** | 顯示論文哪些章節被 agent 引用、哪些是 blind spot，可點擊跳到 Reader |

### 右側 Rail — 4 個 Tab

| # | 功能 | 說明 |
|---|------|------|
| 5 | **Citations（引用清單）** | 所有 source reference，按 agent 分組，分 Academic / Web / Document 類型 |
| 6 | **Reader（文件閱讀器）** | 讀原始論文 / 上傳文件，可跳到特定 chunk，有 citation-backed 才解鎖 |
| 7 | **Flow tab（側欄版 DebateMap）** | 和主畫面 Flow 完全一樣的元件，Round 2 後解鎖 |
| 8 | **Chat（和 AI 對話）** | 針對這個 session / 論文問問題 |

### 工具列動作

| # | 功能 | 說明 |
|---|------|------|
| 9 | **Rerun Review** | 重跑整個辯論 |
| 10 | **Duplicate as New** | 複製設定開新 session |
| 11 | **Export .md** | 匯出完整逐字稿為 Markdown |
| 12 | **Publish Link** | 切換 public/private |
| 13 | **Copy Share URL** | 複製分享連結 |
| 14 | **Open Shared Page** | 在新分頁開公開版 |

---

## 整合評估：必要 / 待調整 / 可刪除

### ✅ 必要（保留，可能調整呈現方式）

| 功能 | 現況 UI 問題 |
|------|-------------|
| Timeline 對話串 | 良好，核心功能 |
| Compare 比較表 | 良好，有獨特價值 |
| Flow / DebateMap | 有價值，但**出現 3 次**（TopBar / Timeline 內部 / Rail tab），需整合 |
| Gap Map | 良好，明確且有用 |
| Citations 清單 | 良好 |
| Reader 閱讀器 | 良好，解鎖邏輯合理 |
| Chat | 良好，有獨特價值 |
| Rerun Review | 必要，但放在 TopBar 太搶眼 |
| Export .md | 必要，低頻操作 |
| 狀態指示燈 | 必要 |
| 論文標題 | 必要 |
| Agent 在線動態（AgentRoster）| 必要，有價值 |

### ⚠️ 待調整（功能留，UI 要改）

**問題 1：視圖切換重複了三層**
```
TopBar tabs：    Timeline / Compare / Flow / Gap Map
Timeline 內部：  Timeline / Compare / Map   ← 幾乎一樣，自己又一套
Sidebar tab：   Flow                        ← 也是 DebateMap
```
→ 只保留 TopBar 的視圖切換，拿掉 Timeline 內部的那套，Sidebar 的 Flow tab 改為「視圖快捷」或直接刪除

**問題 2：分享功能佔了 3 個按鈕**
- `Publish Link / Make Private` + `Copy Share URL` + `Open Shared Page`
- 三個都在 TopBar 搶佔空間
→ 收成一個 **Share** 按鈕 + dropdown，展開才看到切換 public/private、複製連結、開新分頁

**問題 3：TopBar 太擁擠**
- 右側按鈕最多同時有 6 個（Rerun + Duplicate + Export + Publish + Copy + Open）
→ 主要動作 1-2 個，其餘收進「⋯」overflow menu

**問題 4：Sidebar Rail 的 meta 卡片是噪音**
- 4 格：Status / Current Round / Divergence / Resume
- Status 在 TopBar 已有，Current Round 看 Timeline 就知道，Resume "No pending resume" 是廢話
→ 整個刪掉，或縮成 1 行小字

### ❌ 可刪除（沒有核心價值）

| 元素 | 理由 |
|------|------|
| `Session abc12345`（TopBar 的 session ID）| 用戶看不懂也不需要，是開發者資訊 |
| "Left canvas: debate workspace. Right rail: sources…"（說明文字）| 永久貼在畫面上的 UI 說明，應該消失 |
| "Workspace Rail"（Rail 標題）| 對用戶無意義的標籤 |
| stat pills 重複（Rail 有，TopBar 也有）| `N sources · N completed turns · source summary` 重複出現 |
| Sidebar Flow tab | 和主畫面 Flow 視圖完全相同元件，無理由同時存在兩個入口 |
| Open Shared Page 按鈕 | 有 Copy Share URL 已夠，這個冗餘 |
| Duplicate as New | 低頻且容易讓用戶混淆，收進 overflow menu 即可 |

---

## 優先重構建議排序

1. **視圖切換統一** — 三層變一層（影響最大，改完立刻清爽很多）
2. **TopBar 按鈕瘦身** — 保留 Rerun + Share，其餘收進 dropdown
3. **Rail 右側清理** — 刪 meta 卡片 + 刪 "Workspace Rail" 標題 + 刪 stat pills 重複
4. **拿掉 session ID 和說明文字**
5. **Sidebar tab 整理** — Flow tab 刪除，tab 剩 Reader / Citations / Chat 三個

---

## 關鍵檔案索引

| 檔案 | 說明 |
|------|------|
| `src/components/review/session/session-workspace-layout.tsx` | 整體版面（TopBar + Canvas + Rail） |
| `src/components/review/session/session-top-bar.tsx` | TopBar：標題、視圖切換、按鈕列 |
| `src/components/council/discussion-timeline.tsx` | Timeline 視圖 + 內部重複的視圖切換 |
| `src/components/council/compare-view.tsx` | Compare 比較表 |
| `src/components/council/debate-map.tsx` | Flow / DebateMap 挑戰圖 |
| `src/components/council/gap-map-view.tsx` | Gap Map 引用覆蓋熱圖 |
| `src/components/council/review-sidebar.tsx` | 右側 Rail 的 Tab 切換 |
| `src/components/council/source-panel.tsx` | Citations tab |
| `src/components/council/source-reader-panel.tsx` | Reader tab |
| `src/components/council/chat-with-paper.tsx` | Chat tab |
