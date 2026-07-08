// api/_lib/supabase.js — Shared Supabase helpers for Vercel Edge Functions.
// Pure fetch, no SDK, edge-safe. Files/dirs starting with "_" inside /api
// are NOT deployed as routes by Vercel, so this stays internal.
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL              e.g. https://abcdefgh.supabase.co
//   SUPABASE_ANON_KEY         public anon key (auth calls)
//   SUPABASE_SERVICE_ROLE_KEY service role key (server-side inserts; NEVER expose to client)

const URL_  = () => process.env.SUPABASE_URL;
const ANON  = () => process.env.SUPABASE_ANON_KEY;
const SRV   = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export function preflight() {
  return new Response(null, {
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export function envReady() {
  return Boolean(URL_() && ANON() && SRV());
}

// ── Auth (GoTrue REST) ──────────────────────────────────────────────────────

/** Sign up a new user. `metadata` lands in raw_user_meta_data → profiles trigger. */
export async function authSignUp(email, password, metadata = {}) {
  const res = await fetch(`${URL_()}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON() },
    body: JSON.stringify({ email, password, data: metadata }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/** Log in with email + password. Returns { access_token, user, ... } on success. */
export async function authSignIn(email, password) {
  const res = await fetch(`${URL_()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON() },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/** Verify a JWT from the Authorization header. Returns the auth user or null. */
export async function authGetUser(token) {
  if (!token) return null;
  const res = await fetch(`${URL_()}/auth/v1/user`, {
    headers: { apikey: ANON(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Database (PostgREST, service role — server-side only) ───────────────────

/** Insert row(s) into a table. Returns the inserted row(s). */
export async function dbInsert(table, rows) {
  const res = await fetch(`${URL_()}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SRV(),
      Authorization: `Bearer ${SRV()}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Insert into ${table} failed (${res.status})`);
  return Array.isArray(data) ? data : [data];
}

/** Select rows: dbSelect('profiles', 'id=eq.<uuid>&select=*') */
export async function dbSelect(table, query) {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}`, {
    headers: { apikey: SRV(), Authorization: `Bearer ${SRV()}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Select from ${table} failed (${res.status})`);
  return data;
}

/** Fetch a user's profile row by auth user id. */
export async function getProfile(userId) {
  const rows = await dbSelect("profiles", `id=eq.${userId}&select=*&limit=1`);
  return rows?.[0] || null;
}

/** Shape the { user } object the frontend stores in localStorage. */
export function publicUser(authUser, profile) {
  return {
    id:    authUser.id,
    email: authUser.email,
    name:  profile?.name  || authUser.user_metadata?.name || "",
    store: profile?.store || authUser.user_metadata?.store || null,
    phone: profile?.phone || authUser.user_metadata?.phone || null,
    plan:  profile?.plan  || "trial",
    role:  profile?.role  || "merchant",
  };
}

/** Resolve the requester from an Authorization: Bearer header. */
export async function requireUser(req) {
  const auth  = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const user  = await authGetUser(token);
  if (!user?.id) return null;
  const profile = await getProfile(user.id);
  return { user, profile };
}

/** Like requireUser, but only passes for admin/super_admin roles. */
export async function requireAdmin(req) {
  const me = await requireUser(req);
  if (!me?.profile || !["admin", "super_admin"].includes(me.profile.role)) return null;
  return me;
}

/** Update rows: dbUpdate('payments', 'id=eq.<uuid>', { status: 'verified' }) */
export async function dbUpdate(table, query, patch) {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SRV(),
      Authorization: `Bearer ${SRV()}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Update ${table} failed (${res.status})`);
  return Array.isArray(data) ? data : [data];
}

/** Create a user via the GoTrue Admin API (service role). Email is pre-confirmed. */
export async function adminCreateUser(email, password, metadata = {}) {
  const res = await fetch(`${URL_()}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SRV(),
      Authorization: `Bearer ${SRV()}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}
