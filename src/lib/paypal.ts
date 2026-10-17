// PayPal Orders v2 (sandbox only).
// When a watch is set up, the owner approves a hold for the most it may spend.
// The money is only taken (captured) if the agents and the rules all say yes, and never more than the hold.

const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

export class PayPalError extends Error {}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function accessToken(): Promise<string> {
  if (!base.includes("sandbox")) throw new PayPalError("Standby only runs against the PayPal sandbox.");
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new PayPalError("PayPal sandbox keys are missing. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError(`PayPal sign-in failed (${res.status}).`);
  const json = await res.json();
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function call(path: string, method: "GET" | "POST", requestId?: string, body?: unknown) {
  const token = await accessToken();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue;
    const debugId = json?.debug_id;
    if (debugId) console.error(`PayPal ${method} ${path} failed`, res.status, issue, debugId);
    throw new PayPalError(`PayPal said no${issue ? ` (${issue})` : ""}: ${json?.message ?? res.status}`);
  }
  return json;
}

const usd = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });

export async function createHold(input: { mandateId: string; amountCents: number; description: string; returnUrl: string; cancelUrl: string }) {
  const json = await call("/v2/checkout/orders", "POST", `hold-${input.mandateId}`, {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: input.mandateId,
        custom_id: input.mandateId,
        description: input.description.slice(0, 127),
        amount: usd(input.amountCents),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Standby",
          shipping_preference: "NO_SHIPPING",
          user_action: "CONTINUE",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    },
  });
  const approve = (json.links as { rel: string; href: string }[]).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve) throw new PayPalError("PayPal didn't return an approval link.");
  return { orderId: json.id as string, approveUrl: approve.href };
}

export async function authorizeHold(orderId: string) {
  const json = await call(`/v2/checkout/orders/${orderId}/authorize`, "POST", `auth-${orderId}`);
  const auth = json.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new PayPalError("PayPal didn't confirm the hold.");
  return { authorizationId: auth.id as string, status: auth.status as string, expiresAt: auth.expiration_time ? new Date(auth.expiration_time) : null };
}

export async function captureHold(authorizationId: string, amountCents: number, decisionId: string) {
  const json = await call(`/v2/payments/authorizations/${authorizationId}/capture`, "POST", `cap-${decisionId}`, {
    amount: usd(amountCents),
    final_capture: true,
    invoice_id: decisionId,
    note_to_payer: "Bought for you by Standby, after both checks passed.",
  });
  return { captureId: json.id as string, status: json.status as string };
}

export async function releaseHold(authorizationId: string) {
  await call(`/v2/payments/authorizations/${authorizationId}/void`, "POST", `void-${authorizationId}`);
}

export async function getCapture(captureId: string) {
  return call(`/v2/payments/captures/${captureId}`, "GET");
}
