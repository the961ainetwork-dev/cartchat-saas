// api/payments/submit.js — Persists OMT / Whish / Bank / COD payment proofs
// to Supabase for manual verification in the admin panel.
// Receipt files should be uploaded to the private `receipts` Storage bucket
// from the client; pass the resulting path as `receiptUrl`.

export const config = { runtime: "edge" };

import { preflight, json, envReady, dbInsert } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const payment = await req.json();
    if (!payment.customerEmail || !payment.method) {
      return json({ error: "Missing required payment fields" }, 400);
    }

    const [row] = await dbInsert("payments", {
      order_id:       payment.orderId || null,
      customer_email: payment.customerEmail,
      method:         payment.method,
      reference:      payment.reference  || null,
      receipt_url:    payment.receiptUrl || null,
      amount_usd:     payment.amount ?? null,
      status:         "pending_review",
      raw:            payment,
    });

    return json({ ok: true, paymentId: row.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
