import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOTS = path.join(__dirname, "../test-results/screenshots");

test.use({ launchOptions: { headless: false, slowMo: 700 } });
test.setTimeout(60_000);

test("Login → Home visual walkthrough", async ({ page }) => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // 1. Landing page — check Sign in button
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "L01-landing.png"), fullPage: true });

  // 2. Navigate to /login
  await page.click("a[href='/login']");
  await page.waitForURL("**/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "L02-login.png"), fullPage: true });

  // 3. Use dev credentials form (Google/GitHub need real OAuth setup)
  await page.fill('input[type="email"]', "admin@council.local");
  await page.fill('input[type="password"]', "dev-password");
  await page.getByRole("button", { name: /Sign in with credentials/i }).click();
  await page.waitForURL("**/home", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOTS, "L03-home.png"), fullPage: true });

  // 4. Verify home page elements
  await expect(page.getByPlaceholder(/arXiv ID/i)).toBeVisible();
  await expect(page.getByText(/Full Critique/i).first()).toBeVisible();

  // 5. Sidebar — wait for session list to load
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS, "L04-home-loaded.png"), fullPage: true });

  // 6. Collapse sidebar
  await page.locator("aside button[title='Collapse sidebar']").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS, "L05-home-collapsed.png") });

  console.log(`\nScreenshots saved to: ${SCREENSHOTS}`);
});
