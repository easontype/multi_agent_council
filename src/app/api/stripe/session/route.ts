import { NextResponse } from "next/server";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { getWorkspaceTierByEmail } from "@/lib/workspace-tier";

export async function GET() {
  const email = await getAuthenticatedCouncilOwnerEmail();
  if (!email) {
    return NextResponse.json({ tier: "free" });
  }
  const tier = await getWorkspaceTierByEmail(email);
  return NextResponse.json({ tier });
}
