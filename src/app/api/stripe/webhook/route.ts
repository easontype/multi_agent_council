import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { activateProKeyForSession, revokeKeysBySubscription } from "@/lib/api-keys";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("Stripe webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const isPaid =
      session.payment_status === "paid" ||
      session.mode === "subscription";

    if (isPaid) {
      try {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        await activateProKeyForSession(session.id, subscriptionId);
        console.log(`Pro key activated for session ${session.id}`);
      } catch (err) {
        console.error("Failed to activate pro key:", err);
        return NextResponse.json({ error: "Key activation failed" }, { status: 500 });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    try {
      await revokeKeysBySubscription(subscription.id);
      console.log(`Pro key revoked for subscription ${subscription.id}`);
    } catch (err) {
      console.error("Failed to revoke key for subscription:", err);
    }
  }

  return NextResponse.json({ received: true });
}
