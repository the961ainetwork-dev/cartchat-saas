// api/twilio/status.js — Reports which Twilio environment variables are configured,
// WITHOUT ever exposing their actual values. Used by the Admin Channel Setup panel
// to show connection status at a glance.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET, OPTIONS" } });

  const sidSet = !!process.env.TWILIO_ACCOUNT_SID;
  const tokenSet = !!process.env.TWILIO_AUTH_TOKEN;
  const waSet = !!process.env.TWILIO_WHATSAPP_NUMBER;
  const smsSet = !!process.env.TWILIO_SMS_NUMBER;

  return new Response(JSON.stringify({
    sidSet, tokenSet, waSet, smsSet,
    waConfigured: sidSet && tokenSet && waSet,
    smsConfigured: sidSet && tokenSet && smsSet,
  }), { status: 200, headers: cors });
}
