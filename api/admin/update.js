// api/admin/update.js — Admin status updates (admin token required).
// Body: { table, id, status }  or  { table:'profiles', id, plan }
// Tables and values are whitelisted — nothing else can be touched.

export const config = { runtime: "edge" };

import { preflight, json, envReady, requireAdmin, dbUpdate } from "../_lib/supabase.js";

const ALLOWED = {
  payments:         ["pending_review", "verified", "rejected"],
  broadcast_orders: ["pending_review", "approved", "sent", "rejected"],
  orders:           ["pending", "paid", "failed", "refunded", "cancelled"],
  demo_leads:       ["new", "contacted", "qualified", "closed"],
};
const PLANS = ["trial", "starter", "growth", "scale"];

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  const admin = await requireAdmin(req);
  if (!admin) return json({ error: "Admin access required" }, 401);

  try {
    const { table, id, status, plan } = await req.json();
    if (!id) return json({ error: "id is required" }, 400);

    // Plan change on a merchant profile
    if (table === "profiles") {
      if (!PLANS.includes(plan)) return json({ error: "Invalid plan" }, 400);
      const [row] = await dbUpdate("profiles", `id=eq.${id}`, { plan });
      return json({ ok: true, row });
    }

    if (!ALLOWED[table])                 return json({ error: "Invalid table" }, 400);
    if (!ALLOWED[table].includes(status)) return json({ error: "Invalid status" }, 400);

    const [row] = await dbUpdate(table, `id=eq.${id}`, { status });

    // When a payment is verified, mark its linked order paid too.
    if (table === "payments" && status === "verified" && row?.order_id) {
      await dbUpdate("orders", `id=eq.${row.order_id}`, { status: "paid" }).catch(() => {});
    }

    return json({ ok: true, row });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
