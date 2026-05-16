/**
 * Staging verification for red team fixes.
 * Run: node scripts/staging-verify.mjs
 */

const BASE = "http://localhost:3001";
let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ─── 1. Credentials auth ──────────────────────────────────────────────────────

console.log("\n[1] Credentials auth must not be exposed by default");

const providersRes = await fetch(`${BASE}/api/auth/providers`);
const providersJson = await providersRes.json().catch(() => null);
const hasCredentials = providersJson && Object.keys(providersJson).includes("credentials");
ok("GET /api/auth/providers does not expose credentials provider", !hasCredentials,
  `got: ${JSON.stringify(providersJson)}`);

// ─── 2. PDF validation consistency ───────────────────────────────────────────

console.log("\n[2] Fake PDF rejected consistently across upload routes");

const fakePdf = new Blob(["THIS IS NOT A PDF"], { type: "application/pdf" });

// /api/papers/upload
const uploadForm = new FormData();
uploadForm.append("file", new File([fakePdf], "fake.pdf", { type: "application/pdf" }));
const uploadRes = await fetch(`${BASE}/api/papers/upload`, { method: "POST", body: uploadForm });
ok(`/api/papers/upload rejects fake PDF (got ${uploadRes.status})`,
  uploadRes.status >= 400 && uploadRes.status < 500,
  `expected 4xx, got ${uploadRes.status}`);

// /api/papers/ingest — send a fake PDF as pdfUrl (can't actually test file upload path without more setup,
// but we can test that a non-arXiv URL that returns a fake PDF is handled correctly)
// Instead, test the /api/papers/asset route with a direct fetch of a non-existent arXiv ID to verify safe failure
// Note: deep ingest requires a real arXiv ID or PDF URL; we test the route validation path

const assetRes = await fetch(`${BASE}/api/papers/asset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ arxivId: "" }),
});
ok(`/api/papers/asset rejects empty arxivId (got ${assetRes.status})`,
  assetRes.status >= 400 && assetRes.status < 500,
  `expected 4xx, got ${assetRes.status}`);

// /api/papers/ingest with a fake-pdf data URL — test that the route doesn't 500 on invalid input
const ingestRes = await fetch(`${BASE}/api/papers/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pdfUrl: "http://localhost:3001/nonexistent.pdf", title: "Fake" }),
});
ok(`/api/papers/ingest returns a safe error (not 500) for bad PDF URL (got ${ingestRes.status})`,
  ingestRes.status !== 500,
  `got ${ingestRes.status}`);

// ─── 3. Anonymous quota — cookie-stable, UA-rotates ──────────────────────────

console.log("\n[3] Anonymous quota: same cookie + rotating User-Agent stays in same bucket");

// First: get a stable anon cookie by hitting /api/sessions
const seedRes = await fetch(`${BASE}/api/sessions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": "ua-seed" },
  body: JSON.stringify({ topic: "quota-test", rounds: 1, seats: [] }),
});

// Extract anon cookie from Set-Cookie header
const setCookieHeader = seedRes.headers.get("set-cookie") ?? "";
const anonCookieMatch = setCookieHeader.match(/council_anon=([^;]+)/);
const anonCookie = anonCookieMatch ? `council_anon=${anonCookieMatch[1]}` : null;

ok("Server issues council_anon cookie on first anonymous request", !!anonCookie,
  `set-cookie: ${setCookieHeader}`);

if (anonCookie) {
  // Hit quota with fixed cookie until we find the limit
  const QUOTA_LIMIT = 3;
  const statuses = [];
  for (let i = 0; i < QUOTA_LIMIT + 2; i++) {
    const r = await fetch(`${BASE}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `ua-rotation-${i}`,
        Cookie: anonCookie,
      },
      body: JSON.stringify({ topic: `quota-test-${i}`, rounds: 1, seats: [] }),
    });
    statuses.push(r.status);
  }
  const hit429 = statuses.includes(429);
  ok(
    `Quota triggered (429) even with rotating User-Agent (statuses: ${statuses.join(",")})`,
    hit429,
  );
} else {
  console.error("  ✗ Skipped quota rotation test — no anon cookie received");
  failed++;
}

// ─── 4. IDOR — from-asset unauthorized reuse ─────────────────────────────────

console.log("\n[4] IDOR: anonymous client B cannot create session from client A's asset");

// Step 1: client A resolves an asset (use a known arXiv paper)
const clientARes = await fetch(`${BASE}/api/papers/asset`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": "client-A" },
  body: JSON.stringify({ arxivId: "1706.03762" }),
});

if (clientARes.status === 200 || clientARes.status === 201) {
  const clientAJson = await clientARes.json().catch(() => ({}));
  const paperAssetId = clientAJson?.paperAssetId;
  const clientACookies = clientARes.headers.get("set-cookie") ?? "";

  ok("Client A can resolve a paper asset", !!paperAssetId, `assetId: ${paperAssetId}`);

  if (paperAssetId) {
    // Step 2: client B uses the same paperAssetId WITHOUT client A's cookies
    const clientBRes = await fetch(`${BASE}/api/sessions/from-asset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "client-B",
        // Deliberately NO Cookie header from client A
      },
      body: JSON.stringify({ paperAssetId, sessionType: "review" }),
    });

    ok(
      `Client B gets 404 when reusing client A's paperAssetId without owner token (got ${clientBRes.status})`,
      clientBRes.status === 404,
      `expected 404, got ${clientBRes.status}`,
    );

    // Step 3: client A can reuse their own asset (with their cookies)
    const clientAAssetCookieMatch = clientACookies.match(/council_asset_[^=]+=([^;]+)/);
    if (clientAAssetCookieMatch) {
      const clientAReuseRes = await fetch(`${BASE}/api/sessions/from-asset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "client-A",
          Cookie: clientACookies.split(",")[0]?.split(";")[0] ?? "",
        },
        body: JSON.stringify({ paperAssetId, sessionType: "review" }),
      });
      ok(
        `Client A can reuse their own asset (got ${clientAReuseRes.status})`,
        clientAReuseRes.status === 200 || clientAReuseRes.status === 201,
      );
    } else {
      console.log("  ~ Skipped client-A reuse check (no asset-scoped cookie in response)");
    }
  }
} else {
  console.log(`  ~ IDOR test skipped — asset resolution returned ${clientARes.status} (network or quota)`);
  // Don't count as failure — arXiv may be unavailable in staging
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
