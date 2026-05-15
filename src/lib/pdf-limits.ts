import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";

export interface PdfLimits {
  maxBytes: number;
  maxPages: number;
  tier: "free" | "pro";
}

export const PDF_TIER_LIMITS = {
  free: { maxBytes: 5  * 1024 * 1024, maxPages: 30  },
  pro:  { maxBytes: 20 * 1024 * 1024, maxPages: 150 },
} as const;

/** Returns the PDF size+page limits for the current request's authenticated tier. */
export async function getPdfLimitsForRequest(): Promise<PdfLimits> {
  const email = await getAuthenticatedCouncilOwnerEmail();
  if (email) {
    const tier = await getWorkspaceTierByEmail(email);
    if (tier === "pro") return { ...PDF_TIER_LIMITS.pro, tier: "pro" };
  }
  return { ...PDF_TIER_LIMITS.free, tier: "free" };
}
