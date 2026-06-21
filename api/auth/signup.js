export const config = { runtime: "edge" };

function makeToken(userId) {
  const payload = btoa(JSON.stringify({ userId, exp: Date.now() + 86400000 * 7 }));
  return `cc_${payload}`;
}

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const { name, store, email, phone, platform, country, password } = await req.json();
    if (!name || !email || !password) return new Response(JSON.stringify({ error: "Name, email and password are required" }), { status: 400, headers: cors });
    if (password.length < 8) return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers: cors });

    // In production: check if email already exists, hash password, save to DB
    const userId = "user_" + Math.random().toString(36).slice(2, 9);
    const user   = { id: userId, name, store, email, phone, platform, country, plan: "trial" };

    return new Response(JSON.stringify({ token: makeToken(userId), user }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
