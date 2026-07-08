// api/checkout/session.js — Persists an order to Supabase.
// If a logged-in user's token is sent (Authorization: Bearer), the order is
// linked to their account. Card payments via Stripe can be layered on later:
// create a Stripe Checkout Session here and return { url: session.url }.

export const config = { runtime: "edge" };

import { preflight, json, envReady, dbInsert, requireUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const order = await req.json();
    if (!order.plan || !order.email) return json({ error: "Missing required order fields" }, 400);

    const me = await requireUser(req); // optional — guest checkout still works

    const [row] = await dbInsert("orders", {
      user_id:        me?.user?.id || null,
      email:          order.email,
      plan:           order.plan,
      amount_usd:     order.amount ?? order.amount_usd ?? null,
      payment_method: order.method || order.payment_method || null,
      status:         "pending",
      raw:            order,
    });

    return json({ ok: true, orderId: row.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
