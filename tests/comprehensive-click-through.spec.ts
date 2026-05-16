/**
 * Comprehensive click-through test for current Council UI.
 * Tests: landing → home → paper input → review setup (domain picker) → debate setup
 * Screenshots saved to test-screenshots/
 */

import { expect, Page, test } from "@playwright/test";
import path from "path";
import fs from "fs";
import { EncryptJWT } from "jose";
import { hkdf } from "@panva/hkdf";

const AUTH_SECRET = "dev-secret-council-2026-change-in-production";

async function makeSessionCookie(): Promise<string> {
  const key = await hkdf("sha256", AUTH_SECRET, "", "NextAuth.js Generated Encryption Key", 32);
  const now = Math.floor(Date.now() / 1000);
  return new EncryptJWT({
    name: "Test Researcher",
    email: "test@council.local",
    sub: "test-playwright-user",
    iat: now,
    exp: now + 86400,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

async function injectSession(page: Page) {
  const token = await makeSessionCookie();
  await page.context().addCookies([{
    name: "authjs.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
}

const SHOT_DIR = path.join("test-screenshots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
}

// ── Mock API responses ──────────────────────────────────────────────────────

async function mockPaperApis(page: Page) {
  // Preview arXiv paper
  await page.route("**/api/papers/preview**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        arxivId: "1706.03762",
        title: "Attention Is All You Need",
        abstract:
          "We propose the Transformer, a novel, simple network architecture based solely on attention mechanisms.",
        url: "https://arxiv.org/abs/1706.03762",
      }),
    });
  });

  // Asset creation (returns paperAssetId)
  await page.route("**/api/papers/asset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paperAssetId: "asset-test-001",
        title: "Attention Is All You Need",
        abstract:
          "We propose the Transformer, a novel, simple network architecture based solely on attention mechanisms.",
      }),
    });
  });

  // Session creation from asset
  await page.route("**/api/sessions/from-asset", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "session-test-001" }),
    });
  });

  // Session list for /home
  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "session-prev-001",
          title: "Review: Attention Is All You Need",
          status: "concluded",
          created_at: new Date().toISOString(),
        },
      ]),
    });
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("1. Landing page renders key sections", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "01-landing-page");

  // Header nav
  await expect(page.locator("nav")).toBeVisible();

  // Hero heading
  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();

  // arXiv input
  const arxivInput = page.locator('input[placeholder*="arXiv"]').first();
  await expect(arxivInput).toBeVisible();

  // PDF upload button or label
  const pdfLabel = page.locator('label').filter({ hasText: /PDF/i }).first();
  await expect(pdfLabel).toBeVisible();

  // Pricing section
  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await shot(page, "01b-landing-pricing");
  await expect(page.locator("#pricing")).toBeVisible();
});

test("2. Home page: 登入後論文輸入 → preview → confirm → mode cards → review setup", async ({ page }) => {
  await mockPaperApis(page);

  // ── Step 1: Credentials 登入 ───────────────────────────────
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await shot(page, "02a-login-page");

  await page.getByPlaceholder("admin@council.local").fill("admin@council.local");
  await page.getByPlaceholder("Password").fill("admin123");
  await shot(page, "02b-credentials-filled");

  await page.getByRole("button", { name: /sign in with credentials/i }).click();
  await page.waitForURL(/\/home$/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "02c-home-after-login");

  // ── Step 2: DomainPicker 已從首頁移除 ──────────────────────
  // RESEARCH DOMAIN 選擇器不應出現在 /home
  await expect(page.getByText("RESEARCH DOMAIN", { exact: true })).not.toBeVisible();

  const paperInput = page.locator('input[placeholder*="arXiv"]').first();
  await expect(paperInput).toBeVisible();
  await shot(page, "02c-home-input-only");

  // ── Step 3: 輸入 arXiv ID → fetch ─────────────────────────
  await paperInput.fill("1706.03762");
  await page.getByRole("button", { name: /fetch/i }).click();

  await expect(page.getByText("Attention Is All You Need").first()).toBeVisible({ timeout: 8000 });
  await shot(page, "02d-arxiv-preview-card");

  // ── Step 4: Confirm ────────────────────────────────────────
  await page.getByRole("button", { name: /confirm/i }).click();

  await expect(page.getByText("審查論文")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("對抗辯論")).toBeVisible();
  await shot(page, "02e-mode-cards");

  // ── Step 5: 點 Review → 進 setup 頁 ───────────────────────
  await page.getByText("審查論文").click();
  await page.waitForURL(/\/review\/setup\//, { timeout: 8000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "02f-review-setup-domain-picker");

  // Domain picker 應該出現在 setup 頁
  await expect(page.getByText("Research Domain")).toBeVisible();
  await expect(page.getByText("Configure Review")).toBeVisible();
  await expect(page.getByRole("button", { name: /General/i })).toBeVisible();
}, { timeout: 60000 });

test("3. Review setup: domain picker is interactive", async ({ page }) => {
  await mockPaperApis(page);
  await page.goto("/home");
  await page.waitForURL(/\/(home|login)/, { timeout: 6000 });

  if (page.url().includes("/login")) {
    // Navigate directly to setup page (bypass auth for UI test)
    await page.goto("/review/setup/asset-test-001");
    await page.waitForLoadState("networkidle");
  } else {
    // Full flow: fetch paper → confirm → click Review
    const paperInput = page.locator('input[placeholder*="arXiv"]').first();
    await paperInput.fill("1706.03762");
    await page.getByRole("button", { name: /fetch/i }).click();
    await expect(page.getByText("Attention Is All You Need")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText("審查論文")).toBeVisible({ timeout: 8000 });
    await page.getByText("審查論文").click();
    await page.waitForURL(/\/review\/setup\//);
  }

  await page.waitForLoadState("networkidle");
  await shot(page, "03a-review-setup-page");

  // Domain picker section exists
  await expect(page.getByText("Research Domain")).toBeVisible();

  // All 4 domain buttons present
  await expect(page.getByRole("button", { name: /General/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Materials/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Biomedical/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Physics/i })).toBeVisible();
  await shot(page, "03b-review-setup-domain-picker");

  // Click Materials
  await page.getByRole("button", { name: /Materials/i }).click();
  await shot(page, "03c-review-setup-materials-selected");

  // Click Biomedical
  await page.getByRole("button", { name: /Biomedical/i }).click();
  await shot(page, "03d-review-setup-biomedical-selected");

  // Mode picker
  await expect(page.getByText("Review Mode")).toBeVisible();
  await expect(page.getByText("Critical Review")).toBeVisible();
  await expect(page.getByText("Gap Analysis")).toBeVisible();
  await page.getByText("Gap Analysis").click();
  await shot(page, "03e-review-setup-gap-mode");

  // Rounds
  await expect(page.getByText("Rounds", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /2 Rounds/i }).click();
  await shot(page, "03f-review-setup-2-rounds");

  // Launch button
  await expect(page.getByRole("button", { name: /Launch Review/i })).toBeVisible();
});

test("4. Debate setup: domain picker resets roles on change", async ({ page }) => {
  await mockPaperApis(page);
  await page.goto("/debate/setup/asset-test-001");
  await page.waitForLoadState("networkidle");
  await shot(page, "04a-debate-setup-page");

  // Domain picker
  await expect(page.getByText("Research Domain")).toBeVisible();
  await expect(page.getByRole("button", { name: /General/i })).toBeVisible();

  // Switch to Materials — roles should update to materials-specific
  await page.getByRole("button", { name: /Materials/i }).click();
  await shot(page, "04b-debate-setup-materials");

  // Materials domain has different roles (Material Rationalist etc.)
  await expect(page.getByText(/Material|Characterization|Synthesis|Benchmark|Commercial/i).first()).toBeVisible();

  // Switch to Biomedical
  await page.getByRole("button", { name: /Biomedical/i }).click();
  await shot(page, "04c-debate-setup-biomedical");
  await expect(page.getByText(/Safety|Translational|Regulatory|Clinical|Competing/i).first()).toBeVisible();

  // Switch back to General
  await page.getByRole("button", { name: /General/i }).click();
  await shot(page, "04d-debate-setup-general-restored");

  // Positions (Side A / Side B)
  await expect(page.getByText("Positions", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder(/methodology is sound/i)).toBeVisible();

  // Rounds
  await expect(page.getByRole("button", { name: /2 Rounds/i })).toBeVisible();

  // Launch button
  await expect(page.getByRole("button", { name: /Start Debate/i })).toBeVisible();
  await shot(page, "04e-debate-setup-complete");
});

test("5. Landing page → home navigation", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Click "Get started" or "Try it free" button
  const ctaBtn = page.getByRole("link", { name: /Get started|Start for free|Try it free/i }).first();
  await expect(ctaBtn).toBeVisible();
  await ctaBtn.click();

  // Should go to /home or /login (if auth required)
  await page.waitForURL(/\/(home|login)/, { timeout: 8000 });
  await shot(page, "05-landing-to-home-nav");
  expect(page.url()).toMatch(/\/(home|login)/);
});
