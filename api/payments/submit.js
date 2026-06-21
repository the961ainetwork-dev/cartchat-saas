// api/payments/submit.js — Payment proof / receipt capture (OMT, Bank, COD)
// In production: persist to DB, store uploaded file in blob storage (Vercel Blob
// or S3), and notify admin team for verification.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const payment = await req.json();
    if (!payment.customerEmail || !payment.method) {
      return new Response(JSON.stringify({ error: "Missing required payment fields" }), { status: 400, headers: cors });
    }

    // TODO production: persist to DB, upload receipt file to blob storage,
    // notify admin team that a payment needs verification
    console.log("New payment submission:", JSON.stringify(payment));

    return new Response(JSON.stringify({ ok: true, paymentId: payment.id || ("pay_" + Math.random().toString(36).slice(2,9)) }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
