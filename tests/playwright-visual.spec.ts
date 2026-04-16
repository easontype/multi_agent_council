import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOTS = path.join(__dirname, "../test-results/screenshots");

test.use({
  launchOptions: { headless: false, slowMo: 600 },
});

test.setTimeout(120_000);

test("Council — project status check", async ({ page }) => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // ── 1. Landing page ──────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "01-landing.png"), fullPage: true });

  await expect(page.getByText("Council").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /honest feedback/i })).toBeVisible();
  await expect(page.getByPlaceholder(/2301\.07041/i)).toBeVisible();
  await expect(page.getByText("How it works")).toBeVisible();
  console.log("✅ Landing page OK");

  // ── 2. Analyze page ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/analyze`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "02-analyze.png"), fullPage: true });

  await expect(page.getByRole("heading", { name: /new peer review/i })).toBeVisible();
  // shadcn Tabs
  await expect(page.getByRole("tab", { name: /arxiv/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /upload/i })).toBeVisible();
  // shadcn Select triggers
  await expect(page.getByRole("combobox").first()).toBeVisible();
  // Submit button
  await expect(page.getByRole("button", { name: /start review committee/i })).toBeVisible();
  console.log("✅ Analyze page OK");

  // ── 3. Fill arXiv ID ──────────────────────────────────────────────────────
  await page.getByPlaceholder(/2301\.07041/i).fill("1706.03762");
  await page.screenshot({ path: path.join(SCREENSHOTS, "03-arxiv-filled.png") });
  console.log("✅ arXiv input filled");

  // ── 4. Login page ─────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "04-login.png"), fullPage: true });

  await expect(page.getByText("Council").first()).toBeVisible();
  await expect(page.getByPlaceholder("admin@council.local")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in with credentials/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /try free/i })).toBeVisible();
  console.log("✅ Login page OK");

  // ── 5. Home page (unauthenticated redirect) ───────────────────────────────
  await page.goto(`${BASE}/home`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "05-home-or-redirect.png"), fullPage: true });
  console.log(`✅ /home navigated to: ${page.url()}`);

  console.log(`\nAll screenshots: ${SCREENSHOTS}`);
});
