// api/checkout/session.js — Order capture / payment session
// In production: replace this with a real Stripe Checkout Session creation:
//   const session = await stripe.checkout.sessions.create({...})
//   return new Response(JSON.stringify({ url: session.url }))
// and redirect the client to session.url instead of simulating success client-side.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const order = await req.json();
    if (!order.plan || !order.email) {
      return new Response(JSON.stringify({ error: "Missing required order fields" }), { status: 400, headers: cors });
    }

    // TODO production: create Stripe/payment-provider session here, persist order to DB
    console.log("New order:", JSON.stringify(order));

    return new Response(JSON.stringify({ ok: true, orderId: "ord_" + Math.random().toString(36).slice(2, 9) }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
