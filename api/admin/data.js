// api/admin/data.js — GET all admin-panel data in one call (admin token required).
// Returns: { customers, leads, payments, broadcasts, orders }

export const config = { runtime: "edge" };

import { preflight, json, envReady, requireAdmin, dbSelect } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "GET")     return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  const admin = await requireAdmin(req);
  if (!admin) return json({ error: "Admin access required" }, 401);

  try {
    const [customers, leads, payments, broadcasts, orders] = await Promise.all([
      dbSelect("profiles",         "select=*&order=created_at.desc&limit=500"),
      dbSelect("demo_leads",       "select=*&order=created_at.desc&limit=500"),
      dbSelect("payments",         "select=*&order=created_at.desc&limit=500"),
      dbSelect("broadcast_orders", "select=*&order=created_at.desc&limit=500"),
      dbSelect("orders",           "select=*&order=created_at.desc&limit=500"),
    ]);
    return json({ customers, leads, payments, broadcasts, orders });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
