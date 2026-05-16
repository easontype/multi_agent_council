/**
 * Generates a valid NextAuth v5 JWE session token for Playwright tests.
 * Usage: node tests/create-session-cookie.mjs
 */
import { EncryptJWT } from "jose";
import { hkdf } from "@panva/hkdf";

const secret = "dev-secret-council-2026-change-in-production";

// NextAuth v5 derives the encryption key via HKDF (same as next-auth internals)
const keyMaterial = await hkdf(
  "sha256",
  secret,
  "",
  "NextAuth.js Generated Encryption Key",
  32
);

const now = Math.floor(Date.now() / 1000);

const token = await new EncryptJWT({
  name: "Test Researcher",
  email: "test@council.local",
  sub: "test-playwright-user",
  iat: now,
  exp: now + 60 * 60 * 24, // 24 hours
})
  .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
  .encrypt(keyMaterial);

console.log(token);
