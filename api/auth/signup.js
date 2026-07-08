// api/auth/signup.js — Merchant signup via Supabase Auth.
// The DB trigger (db/schema.sql) auto-creates the profiles row from metadata.
// Response shape kept identical to the old stub: { token, user }.

export const config = { runtime: "edge" };

import { preflight, json, envReady, authSignUp, getProfile, publicUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  try {
    const { name, store, email, phone, platform, country, password } = await req.json();

    if (!name || !email || !password) return json({ error: "Name, email and password are required" }, 400);
    if (password.length < 8)          return json({ error: "Password must be at least 8 characters" }, 400);

    const { ok, data } = await authSignUp(email, password, { name, store, phone, platform, country });

    if (!ok) {
      const msg = data?.msg || data?.error_description || data?.message || "Signup failed";
      // Supabase returns 422/400 for duplicates & weak passwords — surface a clean message.
      const friendly = /already|registered|exists/i.test(msg) ? "An account with this email already exists" : msg;
      return json({ error: friendly }, 400);
    }

    // If email confirmation is ON in Supabase, there is no session yet.
    if (!data.access_token) {
      return json({
        ok: true,
        confirmationRequired: true,
        message: "Account created. Please check your email to confirm before logging in.",
      });
    }

    const profile = await getProfile(data.user.id).catch(() => null);
    return json({ token: data.access_token, user: publicUser(data.user, profile) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
