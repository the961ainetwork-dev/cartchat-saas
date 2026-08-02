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

// Supports both legacy JWT keys (eyJ...) and new keys (sb_publishable_/sb_secret_).
// Legacy keys must also be sent as a Bearer token; new keys go in apikey only.
function srvHeaders(extra = {}) {
  const k = SRV();
  const h = { apikey: k, ...extra };
  if (k && !k.startsWith("sb_")) h.Authorization = `Bearer ${k}`;
  return h;
}

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

// ── Admin session tokens (HS256 JWT, edge-safe via Web Crypto) ──────────────
// The master password is used only as a server-side signing secret; it never
// travels to or from the browser. Set ADMIN_JWT_SECRET for a dedicated signing
// key, otherwise the ADMIN_PASSWORD value is used as the secret.
const ADMIN_SECRET = () => process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD || "";

function _b64urlBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function _b64urlStr(str) { return _b64urlBytes(new TextEncoder().encode(str)); }
function _b64urlToBytes(b64url) {
  const pad = "===".slice((b64url.length + 3) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function _hmacKey() {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(ADMIN_SECRET()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

/** Mint a signed admin session token (default lifetime 12h). */
export async function signAdminToken(payload, ttlSeconds = 60 * 60 * 12) {
  const now  = Math.floor(Date.now() / 1000);
  const head = _b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = _b64urlStr(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const data = `${head}.${body}`;
  const sig  = await crypto.subtle.sign("HMAC", await _hmacKey(), new TextEncoder().encode(data));
  return `${data}.${_b64urlBytes(new Uint8Array(sig))}`;
}

/** Verify a signed admin token. Returns its claims if valid & unexpired, else null. */
export async function verifyAdminToken(token) {
  if (!token || !ADMIN_SECRET()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC", await _hmacKey(), _b64urlToBytes(parts[2]), new TextEncoder().encode(data),
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(_b64urlToBytes(parts[1])));
    if (claims.exp && Math.floor(Date.now() / 1000) > claims.exp) return null;
    return claims;
  } catch { return null; }
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
    headers: srvHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Insert into ${table} failed (${res.status})`);
  return Array.isArray(data) ? data : [data];
}

/** Select rows: dbSelect('profiles', 'id=eq.<uuid>&select=*') */
export async function dbSelect(table, query) {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}`, {
    headers: srvHeaders(),
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

/** Like requireUser, but only passes for admin/super_admin roles.
    Accepts a signed master-admin session token (minted at login from the
    ADMIN_PASSWORD secret) — the signature is verified, the password itself
    is never sent as, or compared against, the token. */
export async function requireAdmin(req) {
  const auth  = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  const claims = await verifyAdminToken(token);
  if (claims && ["admin", "super_admin"].includes(claims.role)) {
    return {
      user:    { id: claims.sub || "master-admin", email: claims.email || "admin@cartchat" },
      profile: { name: "CartChat Admin", role: claims.role, plan: "scale" },
    };
  }

  const me = envReady() ? await requireUser(req) : null;
  if (!me?.profile || !["admin", "super_admin"].includes(me.profile.role)) return null;
  return me;
}

/** Update rows: dbUpdate('payments', 'id=eq.<uuid>', { status: 'verified' }) */
export async function dbUpdate(table, query, patch) {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: srvHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
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
    headers: srvHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}
