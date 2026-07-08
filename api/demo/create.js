// api/demo/create.js — Persists qualifier-form demo leads to Supabase.
// Accepts either `business` or the legacy `restaurant` field name.

export const config = { runtime: "edge" };

import { preflight, json, envReady, dbInsert } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const lead = await req.json();
    const business = lead.business || lead.restaurant || lead.store;
    if (!lead.email || !business) return json({ error: "Missing required lead fields" }, 400);

    const [row] = await dbInsert("demo_leads", {
      email:    lead.email,
      business,
      name:     lead.name     || null,
      phone:    lead.phone    || null,
      platform: lead.platform || null,
      country:  lead.country  || null,
      notes:    lead.notes    || null,
      raw:      lead,
    });

    return json({ ok: true, leadId: row.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
