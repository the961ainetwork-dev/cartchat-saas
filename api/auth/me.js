// api/auth/me.js — Validates the current session token and returns the user.
// Call with: fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
// Lets the dashboard verify tokens instead of blindly trusting localStorage.

export const config = { runtime: "edge" };

import { preflight, json, envReady, requireUser, publicUser } from "../_lib/supabase.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "GET")     return json({ error: "Method not allowed" }, 405);
  if (!envReady())              return json({ error: "Supabase environment variables are not set." }, 500);

  const me = await requireUser(req);
  if (!me) return json({ error: "Invalid or expired session" }, 401);

  return json({ user: publicUser(me.user, me.profile) });
}
