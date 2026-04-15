import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { claimPendingKey } from "@/lib/api-keys";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const SENSITIVE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
} as const;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...SENSITIVE_RESPONSE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return jsonNoStore({ error: "session_id is required" }, { status: 400 });
  }

  if (!sessionId.startsWith("cs_")) {
    return jsonNoStore({ error: "Invalid session_id" }, { status: 400 });
  }

  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      stripeSession.mode !== "payment" ||
      stripeSession.status !== "complete" ||
      stripeSession.payment_status !== "paid"
    ) {
      return jsonNoStore(
        { error: "Payment not yet confirmed. Please wait a moment and refresh." },
        { status: 202 }
      );
    }

    const result = await claimPendingKey(sessionId);

    if (!result.found) {
      return jsonNoStore({ error: "Session not found" }, { status: 404 });
    }

    if (result.expired) {
      return jsonNoStore(
        { error: "Payment session expired. Please contact support." },
        { status: 410 }
      );
    }

    if (result.alreadyClaimed) {
      return jsonNoStore(
        { error: "Key already claimed. Check your records." },
        { status: 410 }
      );
    }

    return jsonNoStore({
      id: result.id,
      key: result.plaintextKey,
      name: result.name,
      tier: "pro",
      dailyLimit: 500,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return jsonNoStore({ error: "Session not found" }, { status: 404 });
    }

    console.error("Failed to retrieve key:", error);
    return jsonNoStore({ error: "Failed to retrieve key" }, { status: 500 });
  }
}
