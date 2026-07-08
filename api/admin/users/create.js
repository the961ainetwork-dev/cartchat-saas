// api/admin/users/create.js — Admin creates a merchant account (admin token required).
// Typical flow: a payment is verified → admin opens an account for that customer,
// gets back the credentials, and shares them with the merchant over WhatsApp/email.
//
// Body: { email, name, store?, phone?, platform?, country?, plan?, password? }
// If password is omitted, a strong temporary one is generated and returned ONCE.

export const config = { runtime: "edge" };

import { preflight, json, envReady, requireAdmin, adminCreateUser, dbUpdate } from "../../_lib/supabase.js";

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return "CC-" + Array.from(buf, b => chars[b % chars.length]).join("");
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  const admin = await requireAdmin(req);
  if (!admin) return json({ error: "Admin access required" }, 401);

  try {
    const { email, name, store, phone, platform, country, plan, password } = await req.json();
    if (!email || !name) return json({ error: "Email and name are required" }, 400);

    const pass = password && password.length >= 8 ? password : tempPassword();

    const { ok, data } = await adminCreateUser(email, pass, { name, store, phone, platform, country });
    if (!ok) {
      const msg = data?.msg || data?.message || "Could not create user";
      const friendly = /already|exists|registered|duplicate/i.test(msg)
        ? "A user with this email already exists" : msg;
      return json({ error: friendly }, 400);
    }

    // The DB trigger created the profile; set plan (and any late fields) on top.
    const patch = { plan: plan || "starter" };
    if (store) patch.store = store;
    await dbUpdate("profiles", `id=eq.${data.id}`, patch).catch(() => {});

    return json({
      ok: true,
      user: { id: data.id, email, name, store: store || null, plan: patch.plan },
      // Returned once so the admin can hand credentials to the merchant.
      temporaryPassword: password ? null : pass,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
