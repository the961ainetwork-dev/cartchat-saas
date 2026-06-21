// api/handover/submit.js — Done-For-You handover brief capture
// In production: persist to DB and notify your agency/ops team
// (e.g. Slack webhook, email via Resend) so they can begin onboarding within 24h.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const brief = await req.json();
    if (!brief.restaurant || !brief.name) {
      return new Response(JSON.stringify({ error: "Missing required brief fields" }), { status: 400, headers: cors });
    }

    // TODO production: persist to DB, notify ops team (Slack/email)
    console.log("New handover brief:", JSON.stringify(brief));

    return new Response(JSON.stringify({ ok: true, briefId: "brf_" + Math.random().toString(36).slice(2, 9) }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
