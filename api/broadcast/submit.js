// api/broadcast/submit.js — Persists broadcast requests to Supabase
// with status 'pending_review' for the admin team to approve.

export const config = { runtime: "edge" };

import { preflight, json, envReady, dbInsert, requireUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const order = await req.json();
    if (!order.customerEmail || !order.message) {
      return json({ error: "Missing required order fields" }, 400);
    }

    const me = await requireUser(req); // optional link to account

    const [row] = await dbInsert("broadcast_orders", {
      user_id:        me?.user?.id || null,
      customer_email: order.customerEmail,
      message:        order.message,
      audience:       order.audience || order.segment || null,
      scheduled_for:  order.scheduledFor || null,
      status:         "pending_review",
      raw:            order,
    });

    return json({ ok: true, orderId: row.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
