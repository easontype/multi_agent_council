# Council 上線前修正計畫

**狀態：** ✅ 全部完成（已封存）  
**封存日期：** 2026-05-18

---

## 完成摘要

所有 9 個項目均已修正並驗證：

| 項目 | 說明 | 狀態 | 驗證位置 |
|------|------|------|---------|
| P0-A | 一次 review 被扣兩次配額 | ✅ 已修 | `from-asset/route.ts:101` — 改用 `review_create` |
| P0-B | Debate/Compare 無 Pro 守門 | ✅ 已修 | `from-asset/route.ts:91-99`、`compare/papers/route.ts:56-62`、前端 403 handler 均已補 |
| P1-A | Dashboard「本週」數字顯示今天而非本週 | ✅ 已修 | `home/page.tsx:30-31` — `weekCount` 已正確計算 |
| P1-B | 無 Stripe Customer Portal | ✅ 已修 | `api/stripe/portal/route.ts` 已建、`app-shell.tsx` 有 `handleManageBilling` 與「Manage Billing」按鈕 |
| P1-C | Compare `key={p.arxivId}` 對上傳 PDF 為 null | ✅ 已修 | `compare/page.tsx:663` — `key={p.arxivId ?? \`upload-${i}\`}` |
| P2-A | Error page 謊稱通知了團隊 | ✅ 已修 | `error.tsx:31` — 改為誠實提示 "Try refreshing the page" |
| P2-B | Compare 頁有寫死的中文字 "上傳中…" | ✅ 已修 | `compare/page.tsx:153` — 已改為英文 "Uploading…" |
| P2-C | Landing page 行動版版面失效 | ✅ 已修 | `page.tsx:499-507` — media query `@media (max-width: 680px)` 覆寫 `lp-hero-grid` / `lp-pricing-grid` 為 `1fr` |
| P2-D | Share 頁無 Open Graph meta tags | ✅ 已修 | `share/[id]/page.tsx:8-40` — `generateMetadata` 已加 OG + Twitter tags |

---

## 原始問題清單（已核實完成）

### ✅ P0-A — 一次 review 被扣兩次配額

`from-asset/route.ts:101` 改用 `review_create`，`/run` 仍用 `review_run`，雙重扣費問題已消除。

---

### ✅ P0-B — Adversarial Debate 和 Compare Papers 沒有 Pro 守門

後端兩處均已加 tier gate，前端兩處均已加 403 錯誤提示。

---

### ✅ P1-A — Dashboard「本週」數字其實是「今天」

`weekStart` 計算已加入，stats 使用 `weekCount` 顯示。`todayCount` 仍用於副標題（正確行為）。

---

### ✅ P1-B — 無 Stripe Customer Portal

`/api/stripe/portal/route.ts` 已建立；`app-shell.tsx` Pro 用戶顯示「Manage Billing」按鈕。  
⚠️ 注意：仍需在 Stripe Dashboard → Settings → Billing → Customer portal 手動開啟 Portal，API 才能正常運作。

---

### ✅ P1-C — Compare 結果卡片 `key={p.arxivId}` 對上傳 PDF 為 null

`compare/page.tsx:663` 已改為 `key={p.arxivId ?? \`upload-${i}\`}`。

---

### ✅ P2-A — Error page 謊稱通知了團隊

`error.tsx` 已改為 "An unexpected error occurred. Try refreshing the page."

---

### ✅ P2-B — Compare 頁有寫死的中文字

"上傳中…" 已改為英文 "Uploading…"。

---

### ✅ P2-C — Landing page 行動版版面失效

`page.tsx` 底部加了 `@media (max-width: 680px)` 使用 CSS class 覆寫，Hero 和 Pricing grid 在手機上均改為單欄。

---

### ✅ P2-D — Share 頁無 Open Graph meta tags

`share/[id]/page.tsx` 已加 `generateMetadata` export，包含 `openGraph` 與 `twitter` 欄位。

---

## 不在本計畫內（仍待處理）

- 匿名 session 升級後自動 claim → 需要較大架構改動
- 執行中取消 review → 需 SSE 中斷機制
- Error tracking (Sentry) 完整接入 → 建議上線後第一週補
- Terms of Service / Privacy Policy → 建議上線同步補（法律頁面）
- Stripe Customer Portal 需在 Stripe Dashboard 手動開啟（前置操作）
