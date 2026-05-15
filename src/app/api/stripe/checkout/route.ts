import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import { linkStripeCustomer, getWorkspaceStripeCustomerId } from "@/lib/workspace-tier";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: NextRequest) {
  const email = await getAuthenticatedCouncilOwnerEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required to upgrade" }, { status: 401 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  // Reuse existing Stripe customer if already created
  let customerId = await getWorkspaceStripeCustomerId(email);
  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
    await linkStripeCustomer(email, customerId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${appUrl}/home?upgraded=1`,
    cancel_url: `${appUrl}/home`,
    metadata: { email },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
