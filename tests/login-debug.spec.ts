import { test } from "@playwright/test";
import * as path from "path";

test.use({ launchOptions: { headless: false, slowMo: 600 } });
test.setTimeout(30_000);

test("debug login", async ({ page }) => {
  const S = path.join(__dirname, "../test-results/screenshots");
  await page.goto("http://localhost:3001/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(S, "D1-login.png"), fullPage: true });

  await page.fill('input[type="email"]', "admin@council.local");
  await page.fill('input[type="password"]', "dev-password");
  await page.screenshot({ path: path.join(S, "D2-filled.png"), fullPage: true });

  await page.getByRole("button", { name: /Sign in with credentials/i }).click();

  // Wait and see where we land
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(S, "D3-after-click.png"), fullPage: true });
  console.log("Current URL:", page.url());
});
