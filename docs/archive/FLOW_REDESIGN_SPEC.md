# Council — 入口流程重設計規格書

**版本：** 1.0 | **日期：** 2026-05-09  
**狀態：** 待實作

---

## 一、背景與目標

### 現況問題

| 問題 | 說明 |
|---|---|
| 功能模糊 | 「審查論文」和「對抗辯論」共用同一個 `/review/new` 入口，模式選擇埋在 Step 2 |
| 上傳即執行 | 目前上傳 PDF 後立即觸發 embedding，沒有確認步驟，用戶無法反悔 |
| 流程不對稱 | `/debate/new` 是獨立 wizard，`/review/new` 卻混入 Gap Analysis toggle |
| domain 不持久 | 每次重選 domain，沒有記憶 |

### 目標

1. `/home` 作為唯一入口：先輸入論文 → 確定 → 選功能 → 各自設定
2. 審查論文（`/review/[assetId]`）和對抗辯論（`/debate/[assetId]`）走完全獨立的 UX
3. Domain 偏好持久化（localStorage）
4. Embedding 在背景跑，用戶設定的時間正好讓它完成

---

## 二、新流程總覽

```
/home
│
├─ [Domain 選擇列]  ← localStorage 記住，隨時可切換
│   General / Materials / Biomedical / Physics
│
├─ [論文輸入區]  (inline，不跳頁)
│   ├── 輸入 arXiv ID → fetch 標題/摘要預覽
│   └── 上傳 PDF     → 顯示檔名/摘要前段預覽
│
│   預覽確認：
│   ├── [確定，開始分析] → 觸發 POST /api/papers/asset
│   │                      背景 embedding 啟動
│   │                      → inline 展開模式選擇卡
│   └── [✕ 重選]        → 清空，回到輸入狀態
│
└─ [模式選擇卡]  (確定後 inline 展開)
    ├── [審查論文]  → /review/[assetId]?domain=X
    └── [對抗辯論] → /debate/[assetId]?domain=X

/review/[assetId]            ← 全新頁面
 Step 1: 選模式（Critique / Gap Analysis）
 Step 2: 確認席位與輪次（domain 預帶，可修改）
 Step 3: Launch → /review/session/[id]

/debate/[assetId]            ← 全新頁面
 Step 1: 輸入辯題（Option A vs Option B）
 Step 2: 選角色（domain 預帶，checkbox 鏡像預覽）
 Step 3: Launch → /review/session/[id]
```

---

## 三、Phase 拆分

### Phase A｜拆依賴、封存舊入口（先做）

**目標：** 讓 `/review/new` 和 `/debate/new` 停止作為主入口，清查所有內部連結，改為指向新路由。

#### A-1：清查依賴

掃描以下所有呼叫點，列出需要改路徑的地方：

| 來源 | 現在指向 | 改為 |
|---|---|---|
| `AppShell` sidebar「New Review」 | `/review/new` | `/home`（或移除，由 /home 統一） |
| `AppShell` sidebar「New Debate」（若有） | `/debate/new` | `/home` |
| `src/app/home/page.tsx` handleReview | `/review/new?arxiv=...` | 暫時保留，Phase C 替換 |
| `src/app/home/_components/PaperCard.tsx` | `/review/new?arxiv=...` | Phase C 替換 |
| `src/app/home/reviews/page.tsx`「New Review」按鈕 | `/review/new` | `/home` |
| homepage `src/app/page.tsx`「Start a debate →」 | `/debate/new` | `/home` |
| homepage「Critique Paper」CTA | `/review/new` | `/home` |

#### A-2：封存舊頁面

- 將 `/review/new`、`/review/new/team`、`/debate/new` 標記為 **legacy routes**
- 在頁面頂部加 `/* LEGACY — will be removed after Phase D/E */` 註記
- 不刪除，保留可直接 URL 訪問（向後兼容舊書籤）
- 不在 sidebar / homepage 曝光

#### A-3：更新 AppShell sidebar

移除「New Review」連結，改為：
```
+ 開始新分析    →  /home（捲動到論文輸入區）
```
或直接移除，讓 /home 首頁擔任唯一入口。

---

### Phase B｜新後端端點：`POST /api/papers/asset`

**目標：** 拆出「上傳論文」這個動作，不綁定 session 建立。

#### 端點規格

```
POST /api/papers/asset
Content-Type: multipart/form-data | application/json

Input（擇一）：
  arxivId: string
  file: File (PDF, max 20MB)

Output：
  {
    paperAssetId: string
    title: string
    abstract: string       // 前 600 字
    cacheStatus: "ready" | "processing"
    reusedAsset: boolean
  }

做的事：
  1. 解析論文（fetchArxivPaper 或 extractTextFromPdfBuffer）
  2. resolvePaperAsset（重複偵測）
  3. 若 reusedAsset → cacheStatus: "ready"，不重複 embed
  4. 若新論文   → ingestPaper（背景 embed）→ cacheStatus: "processing"
  5. 回傳 paperAssetId，不建立 council session

不做：
  建 council session（留給各自 launch API）
  選席位、選模式
```

#### 實作位置

```
src/app/api/papers/asset/route.ts   ← 新建
```

大部分邏輯可從 `src/app/api/papers/upload/route.ts` 抽取（步驟 1–2），
session 建立部分移除。

---

### Phase C｜`/home` 重設計

**目標：** 在 /home inline 完成「論文輸入 → 確定 → 模式選擇」。

#### C-1：Domain 選擇列

```tsx
// 放在問候語下方
<DomainPicker
  value={domain}           // 從 localStorage 讀取，預設 'general'
  onChange={setDomain}     // 寫入 localStorage
/>
```

四個 chip：`General` / `Materials` / `Biomedical` / `Physics`  
點選後立即儲存，下次進 /home 自動帶入。

localStorage key：`council.preferred-domain`

#### C-2：論文輸入區（取代現有 SearchBar）

**狀態機：**

```
idle
  ↓ 輸入 arXiv ID 或選擇 PDF
previewing（顯示標題/摘要/檔名預覽）
  ↓ 點「確定，開始分析」
confirming（呼叫 POST /api/papers/asset，loading spinner）
  ↓ 成功
confirmed（展示 paperAssetId、標題、摘要）
  ↓ 點「✕ 重選」
idle（清空）
```

**arXiv 輸入路徑：**
- 輸入 arXiv ID 後點「確認 ID」或按 Enter
- 呼叫 `GET /api/papers/preview?arxiv=XXX`（新端點，只 fetch 標題/摘要，不 embed）
- 顯示預覽卡（標題、摘要前段、來源連結）
- 用戶點「確定，開始分析」→ 觸發 `POST /api/papers/asset`

**PDF 上傳路徑：**
- 拖拉或點選 PDF
- 顯示預覽卡（檔名、大小、PDF 前段文字）
- 用戶點「確定，開始分析」→ 觸發 `POST /api/papers/asset`

**重選：**
- 點「✕」→ 清空所有狀態，回到 idle，`paperAssetId` 丟棄

#### C-3：模式選擇卡（confirmed 後展開）

```
┌──────────────────────────┐  ┌──────────────────────────┐
│       審查論文            │  │       對抗辯論            │
│                          │  │                          │
│  Critique / Gap Analysis │  │  Option A  vs  Option B  │
│  讓 5 位評審找出弱點      │  │  讓兩隊 AI 辯論，給裁決   │
│                          │  │                          │
│     [開始審查 →]          │  │     [開始辯論 →]          │
└──────────────────────────┘  └──────────────────────────┘
```

點擊後導向：
- 審查論文 → `/review/[assetId]?domain=X`
- 對抗辯論 → `/debate/[assetId]?domain=X`

#### C-4：額外端點：論文預覽

```
GET /api/papers/preview?arxiv=XXXX
Output: { title: string, abstract: string, url: string }
做的事: fetch arXiv abstract page，解析 title/abstract，不 embed
```

#### 新增元件

```
src/app/home/_components/DomainPicker.tsx
src/app/home/_components/PaperInputBox.tsx    ← arXiv + PDF 合一
src/app/home/_components/PaperPreviewCard.tsx ← 確認前的預覽
src/app/home/_components/ModeSelectCards.tsx  ← 審查/辯論 兩張卡
```

現有 `SearchBar.tsx` 移入 `_components/legacy/`（保留搜尋功能，Phase C 後評估是否整合）。

---

### Phase D｜新審查流程：`/review/[assetId]`

**目標：** 獨立的審查設定 UX，從模式選擇開始，不含論文上傳。

#### 路由

```
/review/[assetId]          ← 新頁面
/review/[assetId]/setup    ← 席位設定（或 inline 在同頁）
```

#### 流程（3 步驟）

**Step 1：選模式**

```
┌─────────────────────┐  ┌─────────────────────┐
│   Critique 批判審查  │  │   Gap Analysis 缺口  │
│                     │  │                     │
│ 5 位評審找弱點、      │  │ 專注找論文未覆蓋的    │
│ 給出 Accept/Reject  │  │ 研究空間與修改方向    │
└─────────────────────┘  └─────────────────────┘
```

**Step 2：設定**

- Domain 確認（從 URL param 預帶，可修改）
- 席位列表（依 domain + mode 自動初始化，可開關）
- 輪次選擇（1 輪 / 2 輪）
- 進階：per-seat system prompt 編輯

**Step 3：Launch**

- 呼叫現有 `POST /api/papers/upload`（傳入 `paperAssetId` + customSeats）
- 或重構為新的 `POST /api/sessions/create` 端點
- 跳轉至 `/review/session/[sessionId]`

#### 實作位置

```
src/app/review/[assetId]/page.tsx           ← 新建
src/components/review/asset-review-setup/  ← 新建元件目錄
  ├── mode-selector.tsx
  ├── seat-configurator.tsx
  └── launch-button.tsx
```

---

### Phase E｜新辯論流程：`/debate/[assetId]`

**目標：** 獨立的辯論設定 UX，從辯題輸入開始，不含論文上傳。

#### 路由

```
/debate/[assetId]      ← 新頁面（取代舊 /debate/new）
```

#### 流程（3 步驟）

**Step 1：辯題輸入**

```
Option A：[___________]   例：MXene
Option B：[___________]   例：Graphene
Context（選填）：[___________________]
```

**Step 2：選角色**

- Domain 從 URL param 預帶（可修改）
- Checkbox 選角色，即時顯示 A 隊 / B 隊 / 主席 預覽
- 與現有 `RoleSelector` 元件相同邏輯，但視覺重新設計

**Step 3：Launch**

- 呼叫現有 session 建立邏輯（`buildAdversarialTeam` + POST session）
- 跳轉至 `/review/session/[sessionId]`

#### 實作位置

```
src/app/debate/[assetId]/page.tsx           ← 新建
src/components/debate/asset-debate-setup/  ← 新建元件目錄
  ├── topic-input.tsx                       ← 現有 topic-input.tsx 搬移重用
  ├── role-selector.tsx                     ← 現有 role-selector.tsx 搬移重用
  └── launch-button.tsx
```

---

## 四、Phase 執行順序

```
Phase A  拆依賴、封存舊入口       ← 先做，不影響現有功能，最安全
   ↓
Phase B  新後端端點               ← 後端先就緒，前端才能串接
   ↓
Phase C  /home 重設計             ← 核心 UX 變更
   ↓
Phase D  /review/[assetId]       ← 新審查流程
   ↓
Phase E  /debate/[assetId]       ← 新辯論流程
```

---

## 五、不在此次範圍

- Session workspace（`/review/session/[id]`）不動
- Embedding 等待 UI（Phase 5-1 已完成）
- API key / Stripe 流程不動
- 現有 `/review/new`、`/debate/new` 不刪除，legacy 保留

---

## 六、完成標準

| 項目 | 標準 |
|---|---|
| Domain 持久化 | 重新整理 /home 後 domain 選擇不消失 |
| 論文確認流程 | 點「✕」能完整清空，不殘留任何 embedding 痕跡（paper asset 留在 DB 無妨） |
| 兩個入口卡片 | 審查 / 辯論 各自導向獨立頁面，domain 正確帶入 |
| 審查流程 | Step 1 選模式、Step 2 設定、Step 3 launch，全程不出現「上傳論文」 |
| 辯論流程 | Step 1 辯題、Step 2 角色、Step 3 launch，全程不出現「上傳論文」 |
| Legacy 路由 | `/review/new` 和 `/debate/new` 可訪問但不在任何導航中出現 |

---

*規格書由 Claude Code 協助產出，基於 2026-05-09 codebase 狀態。*
