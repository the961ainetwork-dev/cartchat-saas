// api/admin/login.js — Admin authentication
// PRODUCTION TODO: replace ADMIN_USERS with a real database table + hashed passwords
// (bcrypt). Never store plaintext passwords in production.

export const config = { runtime: "edge" };

function makeToken(userId, role) {
  const payload = btoa(JSON.stringify({ userId, role, exp: Date.now() + 86400000 * 7 }));
  return `adm_${payload}`;
}

// Demo admin store — replace with real DB lookup + bcrypt.compare in production
const ADMIN_USERS = [
  { id: "admin1", email: "admin@cartchat.ai", password: "admin1234", name: "CartChat Admin", role: "super_admin" },
];

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const { email, password } = await req.json();
    if (!email || !password) return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400, headers: cors });

    const admin = ADMIN_USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!admin) return new Response(JSON.stringify({ error: "Invalid admin credentials" }), { status: 401, headers: cors });

    const { password: _, ...safeAdmin } = admin;
    return new Response(JSON.stringify({ token: makeToken(admin.id, admin.role), user: safeAdmin }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
