import { test, expect, chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOTS = path.join(__dirname, "../test-results/screenshots");

test.use({
  launchOptions: { headless: false, slowMo: 800 },
});

test.setTimeout(120_000);

test("Council UI — visual walkthrough", async ({ page }) => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // 1. Home page
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "01-home.png"), fullPage: true });
  await expect(page.locator("body")).toBeVisible();

  // 2. Navigate to /analyze — click the nav CTA specifically
  const startLink = page.locator("nav").getByRole("link", { name: /start review/i });
  await startLink.click();
  await page.waitForURL("**/analyze**");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "02-analyze.png"), fullPage: true });
  await expect(page.getByRole("heading", { name: /new peer review/i })).toBeVisible();

  // 3. Fill in arXiv ID
  const arxivInput = page.getByPlaceholder(/2301\.07041/i);
  await arxivInput.fill("1706.03762");
  await page.screenshot({ path: path.join(SCREENSHOTS, "03-form-filled.png"), fullPage: true });

  // 4. Select options
  const modelSelect = page.locator("select").first();
  const options = await modelSelect.locator("option").allTextContents();
  const codexOption = options.find((o) => o.toLowerCase().includes("codex") || o.toLowerCase().includes("haiku"));
  if (codexOption) {
    const val = await modelSelect.locator("option").filter({ hasText: codexOption }).getAttribute("value");
    if (val) await modelSelect.selectOption(val);
  }

  // rounds = 1
  const allSelects = page.locator("select");
  const count = await allSelects.count();
  for (let i = 0; i < count; i++) {
    const sel = allSelects.nth(i);
    const opts = await sel.locator("option").allTextContents();
    if (opts.some((o) => o.includes("round"))) {
      await sel.selectOption({ label: "1 round" });
      break;
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS, "04-options-set.png"), fullPage: true });

  // 5. Submit
  await page.getByRole("button", { name: /start review committee/i }).click();

  // Wait for redirect to /results/
  await page.waitForURL("**/results/**", { timeout: 30_000 });
  await page.screenshot({ path: path.join(SCREENSHOTS, "05-results-redirect.png"), fullPage: true });

  // 6. Wait for committee sidebar to appear
  await page.waitForSelector("text=COMMITTEE", { timeout: 10_000 }).catch(() => {});
  await page.screenshot({ path: path.join(SCREENSHOTS, "06-results-committee.png"), fullPage: true });

  // 7. Wait a bit more — watch the debate begin
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: path.join(SCREENSHOTS, "07-results-debate.png"), fullPage: true });

  console.log(`\nScreenshots saved to: ${SCREENSHOTS}`);
});
