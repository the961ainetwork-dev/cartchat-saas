// api/auth/login.js — Merchant login via Supabase Auth.
// Response shape kept identical to the old stub: { token, user }.

export const config = { runtime: "edge" };

import { preflight, json, envReady, authSignIn, getProfile, publicUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    const { ok, data } = await authSignIn(email, password);
    if (!ok || !data.access_token) {
      const msg = data?.error_description || data?.msg || "Invalid email or password";
      return json({ error: /confirm/i.test(msg) ? "Please confirm your email first" : "Invalid email or password" }, 401);
    }

    const profile = await getProfile(data.user.id).catch(() => null);
    return json({ token: data.access_token, user: publicUser(data.user, profile) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
