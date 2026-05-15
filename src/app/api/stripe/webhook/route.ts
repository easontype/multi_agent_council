import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { setWorkspaceTierByCustomerId } from "@/lib/workspace-tier";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const tier = ACTIVE_STATUSES.has(sub.status) ? "pro" : "free";
    await setWorkspaceTierByCustomerId(
      sub.customer as string,
      tier,
      sub.id,
    );
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await setWorkspaceTierByCustomerId(sub.customer as string, "free", null);
  }

  return NextResponse.json({ received: true });
}
