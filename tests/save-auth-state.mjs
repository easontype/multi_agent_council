/**
 * Run this once to log in via Google and save the session.
 * Usage: node tests/save-auth-state.mjs
 * After Google login completes, storageState is saved to tests/.auth/user.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

mkdirSync("tests/.auth", { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext();
const page = await context.newPage();

console.log("Opening login page — please sign in with Google...");
await page.goto("http://localhost:3001/login");

// Wait until user completes login and lands on /home (up to 3 minutes)
await page.waitForURL("http://localhost:3001/home", { timeout: 180000 });
console.log("Login detected! Saving session...");

await context.storageState({ path: "tests/.auth/user.json" });
console.log("Session saved to tests/.auth/user.json");

await browser.close();
process.exit(0);
