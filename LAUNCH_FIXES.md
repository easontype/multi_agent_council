# Council 上線前修正計畫

**狀態：** 待修正  
**截止：** 上線前完成

---

## 問題清單（已核實）

### 🔴 P0 — 必修，否則不能上線

#### [P0-A] 一次 review 被扣兩次配額

**現象**  
使用者從 setup 頁點 Launch → 被算一次 `review_run` → 導向 review/[id] → workspace 自動 resume stream → 再算一次 `review_run`。免費用戶 3/day，實際上一次完整 review 會消耗 2 次，等於一天只能跑 1 次（第二次會被擋）。

**核實位置**  
- `src/app/api/sessions/from-asset/route.ts:75` — `checkEntitlement(req, "review_run", ...)`  
- `src/app/api/sessions/[id]/run/route.ts:81` — `checkEntitlement(req, "review_run", ...)` (when `!existingJob`)  
- `src/components/review/use-review-session-workspace-state.ts:74` — 頁面載入自動呼叫 `resumeSession(forcedSessionId)`

**根因**  
`from-asset` 負責「建立 session 記錄」，邏輯上應該消耗 `review_create` 配額；`/run` 負責「啟動 AI 計算」，應該消耗 `review_run`。目前兩個都打 `review_run`。

**修正**

`src/app/api/sessions/from-asset/route.ts` 第 75 行：

```diff
- const quota = await checkEntitlement(req, "review_run", anonymousVisitor ?? undefined);
+ const quota = await checkEntitlement(req, "review_create", anonymousVisitor ?? undefined);
```

修完後確認 `entitlements.ts` 裡 `review_create` 的 free limit：
- 目前是 3/10min + 10/week → 符合 landing page 的 "10 reviews/week" 宣傳

---

#### [P0-B] Adversarial Debate 和 Compare Papers 沒有 Pro 守門

**現象**  
Landing page 及 pricing 明確標記這兩個功能為 PRO。但任何人（含免費用戶）直接 POST 到 API 即可使用，後端完全沒有 tier 檢查。

**核實位置**  
- `src/app/page.tsx:543,550` — landing 標記 PRO  
- `src/app/page.tsx:643,648` — pricing 列 PRO features  
- `src/app/api/sessions/from-asset/route.ts:120` — debate branch，無 tier gate  
- `src/app/api/compare/papers/route.ts:54` — 只查 `web_analyze` 配額，無 tier check

**修正 1：`from-asset/route.ts`**

在 `sessionType` 確定為 `"debate"` 之後、組 seats 之前加 tier gate：

```typescript
// 在 line 90 之後插入
if (sessionType === "debate") {
  const tier = account ? await getWorkspaceTierByEmail(account.email) : "free";
  if (tier !== "pro") {
    return applyEntitlementResponse(
      NextResponse.json(
        { error: "Adversarial Debate is a Pro feature. Upgrade to access it." },
        { status: 403 }
      ),
      quota,
    );
  }
}
```

需要在檔案頂端加 import：
```typescript
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";
```

**修正 2：`compare/papers/route.ts`**

在 quota check 通過後、解析 body 之前加 tier gate：

```typescript
// 在 line 55 之後插入
const compareTier = account ? await getWorkspaceTierByEmail(account.email) : "free";
if (compareTier !== "pro") {
  return applyEntitlementResponse(
    NextResponse.json(
      { error: "Paper comparison is a Pro feature. Upgrade to access it." },
      { status: 403 }
    ),
    quota,
  );
}
```

需要在檔案頂端加 import：
```typescript
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";
```

**修正 3：前端顯示升級提示**

`src/app/home/compare/page.tsx` 的 `handleCompare()` function，在 `!res.ok` 分支加：

```typescript
if (res.status === 403) {
  setError("Paper comparison is a Pro feature. Upgrade at Settings → Billing.")
  setPhase('error')
  return
}
```

`src/app/debate/setup/[assetId]/page.tsx` 的 `handleLaunch()` function，在 error 分支加：

```typescript
if (res.status === 403) {
  setError("Adversarial Debate is a Pro feature. Please upgrade your plan.")
  setLaunching(false)
  return
}
```

---

### 🟠 P1 — 上線前強烈建議修正

#### [P1-A] Dashboard「本週」數字其實是「今天」

**現象**  
Stats 第二格標題是「This Week」、sub 是「weekly limit」，但顯示的數字是今天建立的 sessions 數，不是本週。使用者被擋後來看統計，發現數字對不上。

**核實位置**  
- `src/app/home/page.tsx:29` — `todayCount = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length`  
- `src/app/home/page.tsx:54-57` — `value: \`${todayCount} / 10\`, sub: t.home_stat_weekly_limit`

**修正**

```diff
- const todayCount = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length;
+ const weekStart = new Date();
+ weekStart.setDate(weekStart.getDate() - weekStart.getDay());
+ weekStart.setHours(0, 0, 0, 0);
+ const weekCount = sessions.filter(s => new Date(s.created_at) >= weekStart).length;
```

然後把用到 `todayCount` 的地方換成 `weekCount`：

```diff
- { label: t.home_stat_this_week, value: loadingSessions ? "—" : `${todayCount} / 10`, sub: t.home_stat_weekly_limit },
+ { label: t.home_stat_this_week, value: loadingSessions ? "—" : `${weekCount} / 10`, sub: t.home_stat_weekly_limit },
```

注意：`page.tsx:89-93` 的 subtitle 用到 `todayCount`（顯示「今天幾場」），這個保持不變是對的，只修 stats 那格。

---

#### [P1-B] 無 Stripe Customer Portal（付費後無法自行管理訂閱）

**現象**  
使用者升級後沒有任何地方可以查看方案、取消訂閱、更換付款方式。只能找你人工處理。

**核實位置**  
- `src/app/api/stripe/checkout/route.ts` — 只有 checkout  
- `src/app/api/stripe/webhook/route.ts` — 只有 webhook  
- 無 portal route、無 billing 設定頁

**前置條件（需在 Stripe Dashboard 操作）**  
1. 登入 Stripe Dashboard → Settings → Billing → Customer portal  
2. 開啟 Portal，設定允許的操作（取消訂閱、更換付款方式等）  
3. 存擋。此步驟不做，API 呼叫會 throw。

**修正 1：新增 `/api/stripe/portal/route.ts`**

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { getWorkspaceStripeCustomerId } from "@/lib/workspace-tier";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST() {
  const email = await getAuthenticatedCouncilOwnerEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const customerId = await getWorkspaceStripeCustomerId(email);
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Please upgrade first." },
      { status: 404 }
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/home`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

**修正 2：`app-shell.tsx` — Pro 用戶顯示「Manage Billing」按鈕**

在 `handleUpgrade` function 旁邊加：

```typescript
async function handleManageBilling() {
  try {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json() as { url?: string };
    if (data.url) window.location.href = data.url;
  } catch {}
}
```

在 Pro tier 時替換 Upgrade button：

```diff
- {!collapsed && session?.user && tier === 'free' && (
-   <button onClick={...}>Upgrade to Pro</button>
- )}
+ {!collapsed && session?.user && tier === 'free' && (
+   <button onClick={() => { void handleUpgrade() }} ...>Upgrade to Pro</button>
+ )}
+ {!collapsed && session?.user && tier === 'pro' && (
+   <button
+     onClick={() => { void handleManageBilling() }}
+     style={{
+       width: '100%', background: 'none', border: '1px solid #ebebed',
+       borderRadius: 6, padding: '7px 10px', fontSize: 11,
+       fontWeight: 600, color: '#6366f1', cursor: 'pointer',
+       display: 'flex', alignItems: 'center', justifyContent: 'center',
+     }}
+   >
+     Manage Billing
+   </button>
+ )}
```

---

#### [P1-C] Compare 結果卡片 `key={p.arxivId}` 對上傳 PDF 為 null

**現象**  
比較兩篇 PDF 上傳時，兩張 PaperCard 的 `key` 都是 `null`，React 出現 duplicate key warning，可能導致卡片內容對位錯誤或狀態殘留。

**核實位置**  
- `src/app/home/compare/page.tsx:657`

**修正**

```diff
- {papers.map((p, i) => (
-   <PaperCard key={p.arxivId} paper={p} index={i} />
- ))}
+ {papers.map((p, i) => (
+   <PaperCard key={p.arxivId ?? `upload-${i}`} paper={p} index={i} />
+ ))}
```

---

### 🟡 P2 — 不修也能上線，但影響留存與信任

#### [P2-A] Error page 謊稱通知了團隊

**核實位置**  
`src/app/error.tsx:12` — 只有 `console.error`，訊息卻說 "The team has been notified."

**修正選項 A（最快，誠實）**  
改訊息：

```diff
- An unexpected error occurred. The team has been notified.
+ An unexpected error occurred. Please try again or refresh the page.
```

**修正選項 B（建議長期）**  
接 Sentry 或 Highlight.io：
```typescript
import * as Sentry from "@sentry/nextjs";
// in useEffect:
Sentry.captureException(error);
```

---

#### [P2-B] Compare 頁有寫死的中文字

**核實位置**  
`src/app/home/compare/page.tsx:155` — `"上傳中…"` 沒有走 i18n

**修正**  
查 `translations.ts` 是否已有對應 key（如 `common_uploading` 或 `input_processing`），若有直接替換；若無則新增一個 key。

```diff
- <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}><SpinnerIcon /> 上傳中…</span>
+ <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}><SpinnerIcon /> {t.input_processing}</span>
```

---

#### [P2-C] Landing page 行動版版面失效

**核實位置**  
`src/app/page.tsx:115` — Hero grid `gridTemplateColumns: "1fr 1fr"` 無 responsive fallback  
`src/app/page.tsx:456` — Pricing grid 同樣問題

**修正**  
兩處各改為使用 CSS 媒體查詢或 `auto-fit`：

Hero section（line ~115）：
```diff
- gridTemplateColumns: "1fr 1fr"
+ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
```

Pricing section（line ~456）：
```diff
- gridTemplateColumns: "1fr 1fr"
+ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
```

---

#### [P2-D] Share 頁無 Open Graph meta tags

**現象**  
Share 連結貼到 Twitter/Slack/Line 時只顯示空白預覽，沒有標題、描述、縮圖。Share 是核心功能，空白預覽降低傳播力。

**核實位置**  
`src/app/share/[id]/page.tsx` — Server Component，無 metadata export

**修正**

在 `share/[id]/page.tsx` 加上 Next.js metadata export：

```typescript
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getPublicBundle(id);
  if (!bundle?.session) return { title: "Council" };

  const { session, conclusion } = bundle;
  const decision = conclusion?.editorial_decision
    ? ` · ${conclusion.editorial_decision}`
    : "";

  return {
    title: `${session.title}${decision} — Council Review`,
    description:
      conclusion?.summary?.slice(0, 160) ??
      `Multi-agent AI peer review of "${session.title}"`,
    openGraph: {
      title: `${session.title}${decision}`,
      description:
        conclusion?.summary?.slice(0, 160) ??
        `Multi-agent peer review`,
      siteName: "Council",
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${session.title}${decision}`,
      description: conclusion?.summary?.slice(0, 160) ?? "",
    },
  };
}
```

---

## 執行順序

| 順序 | 項目 | 預估時間 | 風險 |
|------|------|----------|------|
| 1 | [P0-A] 修 from-asset 配額 | 5 min | 低 — 一行改動 |
| 2 | [P0-B] Debate + Compare tier gate | 30 min | 低 — 純新增判斷，不改流程 |
| 3 | [P1-A] Dashboard 週/日統計 | 10 min | 低 |
| 4 | [P1-C] Compare key prop | 5 min | 低 |
| 5 | [P2-B] 中文寫死字串 | 5 min | 低 |
| 6 | [P2-A] Error page 文案 | 5 min | 低 |
| 7 | [P1-B] Stripe portal | 45 min | 中 — 需 Stripe dashboard 設定 |
| 8 | [P2-C] Landing mobile | 20 min | 低 — CSS only |
| 9 | [P2-D] Share OG tags | 20 min | 低 |

**1-6 合計：約 1 小時**  
**1-9 全部：約 2.5 小時**

---

## 不在本計畫內（記錄備用）

- 匿名 session 升級後自動 claim → 需要較大架構改動，非上線阻塞
- 執行中取消 review → 需 SSE 中斷機制，非上線阻塞
- Error tracking (Sentry) 完整接入 → 建議上線後第一週補
- Terms of Service / Privacy Policy → 建議上線同步補（法律頁面）
