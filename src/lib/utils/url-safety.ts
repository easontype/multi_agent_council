import { promises as dnsPromises } from "dns";

// ─── Parse-time hostname blocklist ────────────────────────────────────────────
// Checked against the parsed hostname before any network activity.
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^169\.254\./,           // link-local
  /^10\./,                 // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918
  /^192\.168\./,           // RFC 1918
  /^fd[0-9a-f]{2}:/i,     // ULA IPv6
  /^fe80:/i,               // link-local IPv6
  /^::ffff:/i,             // IPv4-mapped IPv6 — check embedded IPv4 separately (see below)
  /^100\.64\./,            // CGNAT (RFC 6598)
  /^192\.0\.2\./,          // TEST-NET-1
  /^198\.51\.100\./,       // TEST-NET-2
  /^203\.0\.113\./,        // TEST-NET-3
  /^240\./,                // reserved
];

/**
 * Returns true when `addr` (IPv4 or IPv6) is safe to connect to.
 * Handles IPv4-mapped IPv6 (`::ffff:x.x.x.x`) by extracting the embedded IPv4.
 */
function isAddressSafe(addr: string): boolean {
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const check = mapped ? mapped[1] : addr;
  return !BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(check));
}

/**
 * Parse-time URL validation.
 * Checks protocol and hostname against the blocklist — fast, synchronous.
 * Not sufficient alone: use `safeFetch()` for actual network requests.
 */
export function isAllowedExternalUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(host))) return false;
  // Reject bare IP literals that look private (not caught by hostname patterns above)
  // e.g. https://192.168.1.1/path — already caught, but be explicit for IPv6 literals
  return true;
}

/**
 * DNS-level validation after resolution.
 * Resolves all A/AAAA records and checks each resolved address.
 * Returns false if any resolved address is in a blocked range, or if DNS fails.
 *
 * Note: this does not fully eliminate DNS rebinding (TOCTOU window remains between
 * resolution here and the OS resolver used by fetch()), but it significantly raises
 * the attack bar by requiring sub-TTL rebinding with precise timing.
 */
async function validateResolvedAddresses(hostname: string): Promise<boolean> {
  try {
    const [v4, v6] = await Promise.all([
      dnsPromises.resolve4(hostname).catch(() => [] as string[]),
      dnsPromises.resolve6(hostname).catch(() => [] as string[]),
    ]);
    const all = [...v4, ...v6];
    if (all.length === 0) return false; // unresolvable = not allowed
    return all.every(isAddressSafe);
  } catch {
    return false;
  }
}

/**
 * SSRF-safe fetch wrapper.
 *
 * Two-layer protection:
 *   1. Parse-time: protocol + hostname blocklist (`isAllowedExternalUrl`)
 *   2. DNS-time:   resolve A/AAAA records and verify every IP is public
 *
 * Throws `Error("SSRF_BLOCKED")` if either check fails, so callers can
 * distinguish SSRF blocks from transient network errors.
 */
export async function safeFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  if (!isAllowedExternalUrl(url)) {
    throw Object.assign(new Error("SSRF_BLOCKED"), { ssrfBlocked: true });
  }
  const parsed = new URL(url);
  const dnsOk = await validateResolvedAddresses(parsed.hostname);
  if (!dnsOk) {
    throw Object.assign(new Error("SSRF_BLOCKED"), { ssrfBlocked: true });
  }
  return fetch(url, options);
}
