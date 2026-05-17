import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { getWorkspaceStripeCustomerId } from "@/lib/workspace-tier";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST() {
  const email = await getAuthenticatedCouncilOwnerEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const customerId = await getWorkspaceStripeCustomerId(email);
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Please upgrade first." },
      { status: 404 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/home`,
  });

  return NextResponse.json({ url: portalSession.url });
}
