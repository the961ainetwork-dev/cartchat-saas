// api/admin/login.js — Admin authentication via Supabase Auth + role check.
// Admins are normal Supabase users whose profiles.role is 'admin' or 'super_admin'.
// To create one: sign up normally, then in the Supabase SQL editor run:
//   update public.profiles set role = 'super_admin' where id = '<auth-user-uuid>';
// Response shape kept identical to the old stub: { token, user }.

export const config = { runtime: "edge" };

import { preflight, json, envReady, authSignIn, getProfile } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    const { ok, data } = await authSignIn(email, password);
    if (!ok || !data.access_token) return json({ error: "Invalid admin credentials" }, 401);

    const profile = await getProfile(data.user.id).catch(() => null);
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      // Valid account, but not an admin — do not leak which.
      return json({ error: "Invalid admin credentials" }, 401);
    }

    return json({
      token: data.access_token,
      user: { id: data.user.id, email: data.user.email, name: profile.name, role: profile.role },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
