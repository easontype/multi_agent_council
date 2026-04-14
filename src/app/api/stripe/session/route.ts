import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { claimPendingKey } from "@/lib/api-keys";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  try {
    // Verify payment status with Stripe before revealing the key.
    // This guards against the success page being hit before the webhook fires.
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (stripeSession.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not yet confirmed — please wait a moment and refresh." },
        { status: 202 }
      );
    }

    const result = await claimPendingKey(sessionId);

    if (!result.found) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (result.expired) {
      return NextResponse.json(
        { error: "Payment session expired. Please contact support." },
        { status: 410 }
      );
    }

    if (result.alreadyClaimed) {
      return NextResponse.json({ error: "Key already claimed — check your records." }, { status: 410 });
    }

    return NextResponse.json({
      id: result.id,
      key: result.plaintextKey,
      name: result.name,
      tier: "pro",
      dailyLimit: 500,
    });
  } catch (error) {
    console.error("Failed to retrieve key:", error);
    return NextResponse.json({ error: "Failed to retrieve key" }, { status: 500 });
  }
}
