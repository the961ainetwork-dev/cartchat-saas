// api/handover/submit.js — Persists Done-For-You handover briefs to Supabase
// so the ops team can start onboarding.

export const config = { runtime: "edge" };

import { preflight, json, envReady, dbInsert, requireUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const brief = await req.json();
    if (!brief || Object.keys(brief).length === 0) {
      return json({ error: "Empty handover brief" }, 400);
    }

    const me = await requireUser(req); // optional link to account

    const [row] = await dbInsert("handover_briefs", {
      user_id:        me?.user?.id || null,
      customer_email: brief.email || brief.customerEmail || null,
      brief,
      status:         "new",
    });

    return json({ ok: true, briefId: row.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
