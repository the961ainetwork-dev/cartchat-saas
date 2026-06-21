// api/demo/create.js — Logs qualifier-form demo leads
// In production: write to a real database (Supabase recommended) and trigger
// a CRM/email notification (e.g. via Resend, SendGrid) to your sales team.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const lead = await req.json();

    // Minimal validation
    if (!lead.email || !lead.restaurant) {
      return new Response(JSON.stringify({ error: "Missing required lead fields" }), { status: 400, headers: cors });
    }

    // TODO production: persist `lead` to your database here, e.g.:
    // await supabase.from('demo_leads').insert({ ...lead })
    console.log("New demo lead:", JSON.stringify(lead));

    return new Response(JSON.stringify({ ok: true, leadId: "lead_" + Math.random().toString(36).slice(2, 9) }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
