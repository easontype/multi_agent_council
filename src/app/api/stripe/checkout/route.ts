import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { reserveProKeyForSession } from "@/lib/api-keys";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

function getCheckoutBaseUrl(): string {
  const configuredUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : undefined);

  if (!configuredUrl) {
    throw new Error("APP_URL is not configured");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL is invalid");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("APP_URL must use http or https");
  }

  return parsedUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const baseUrl = getCheckoutBaseUrl();

    // Create Stripe session first to get the session ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      metadata: { name, email: email ?? "" },
      success_url: `${baseUrl}/keys/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/keys?cancelled=1`,
    });

    // Pre-generate and reserve the Pro key tied to this session
    await reserveProKeyForSession(session.id, name, email);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
