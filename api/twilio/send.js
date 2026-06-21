// api/twilio/send.js — Outbound message sender (WhatsApp or SMS)
//
// Used by the Admin panel to actually deliver an approved broadcast order,
// or by any future automated flow (e.g. order confirmations) that needs to
// proactively message a customer rather than reply to an inbound message.
//
// SETUP REQUIRED (Vercel environment variables):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_NUMBER  (for channel: "whatsapp")
//   TWILIO_SMS_NUMBER       (for channel: "sms")
//
// Request body: { channel: "whatsapp" | "sms", to: "+9611234567", message: "..." }
//
// NOTE: For WhatsApp, Twilio requires the "to" number to either have messaged
// you within the last 24 hours, OR you must use a pre-approved Message
// Template for outbound-initiated (e.g. broadcast/marketing) messages. Plain
// freeform text only works for replies within an active 24h conversation
// window — see Twilio's Content API / Template docs for broadcast sending.

export const config = { runtime: "nodejs" };

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const smsNumber = process.env.TWILIO_SMS_NUMBER;

  if (!accountSid || !authToken) {
    res.status(500).json({ error: "Twilio not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN" });
    return;
  }

  const { channel, to, message } = req.body || {};
  if (!channel || !to || !message) {
    res.status(400).json({ error: "Missing required fields: channel, to, message" });
    return;
  }
  if (!["whatsapp", "sms"].includes(channel)) {
    res.status(400).json({ error: "channel must be 'whatsapp' or 'sms'" });
    return;
  }

  const fromNumber = channel === "whatsapp" ? waNumber : smsNumber;
  if (!fromNumber) {
    res.status(500).json({ error: `TWILIO_${channel === "whatsapp" ? "WHATSAPP" : "SMS"}_NUMBER not configured` });
    return;
  }

  try {
    const client = twilio(accountSid, authToken);
    const toAddress = channel === "whatsapp" ? `whatsapp:${to}` : to;
    const fromAddress = channel === "whatsapp" ? fromNumber : fromNumber;

    const result = await client.messages.create({
      from: fromAddress,
      to: toAddress,
      body: message,
    });

    res.status(200).json({ ok: true, sid: result.sid, status: result.status });
  } catch (err) {
    console.error("Twilio send error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
