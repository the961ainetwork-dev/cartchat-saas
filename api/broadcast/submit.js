// api/broadcast/submit.js — Broadcast order capture
// In production: persist to DB, notify admin team (Slack/email) for review.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const order = await req.json();
    if (!order.customerEmail || !order.message) {
      return new Response(JSON.stringify({ error: "Missing required order fields" }), { status: 400, headers: cors });
    }

    // TODO production: persist to DB, notify admin team that a new order needs review
    console.log("New broadcast order:", JSON.stringify(order));

    return new Response(JSON.stringify({ ok: true, orderId: order.id || ("ord_" + Math.random().toString(36).slice(2,9)) }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
