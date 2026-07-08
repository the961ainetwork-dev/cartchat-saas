// api/twilio/whatsapp.js — Twilio WhatsApp webhook
//
// This replaces the old Meta-direct webhook (api/whatsapp.js) with one that
// goes through Twilio's WhatsApp Business API integration.
//
// SETUP REQUIRED (Vercel environment variables):
//   TWILIO_ACCOUNT_SID       - from twilio.com/console
//   TWILIO_AUTH_TOKEN        - from twilio.com/console
//   TWILIO_WHATSAPP_NUMBER   - your Twilio WhatsApp-enabled number, format: whatsapp:+14155238886
//   ANTHROPIC_API_KEY        - already set for the chat AI
//
// Twilio webhook configuration (in Twilio Console → Messaging → WhatsApp Senders):
//   Set "When a message comes in" to: https://yourdomain.com/api/twilio/whatsapp
//   Method: POST
//
// NOTE: This uses the Node.js runtime (not edge) because the Twilio SDK
// requires Node APIs. Twilio sends webhooks as application/x-www-form-urlencoded,
// not JSON — this handler parses that format.

export const config = { runtime: "nodejs" };

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Twilio environment variables not configured");
    res.status(500).send("Server not configured");
    return;
  }

  // Twilio sends form-encoded data: Body (message text), From (sender's WhatsApp number)
  const body = req.body || {};
  const userText = body.Body;
  const fromWhatsApp = body.From; // e.g. "whatsapp:+96170123456"

  if (!userText || !fromWhatsApp) {
    res.status(200).send("OK"); // acknowledge, nothing to process
    return;
  }

  // In production: look up the merchant's system prompt / config from your database
  // based on the Twilio number that received this message (body.To), so each
  // merchant's AI agent has its own personality, menu/catalog, and policies.
  const systemPrompt = process.env.AGENT_SYSTEM_PROMPT || `You are CartChat, a friendly AI WhatsApp assistant for an online store.
You help with order tracking, product questions, and abandoned cart recovery.
Be warm, concise (2-3 sentences), use emojis naturally, and proactively suggest products.
Respond in the same language the customer uses (Arabic or English).`;

  let aiReply = "Thanks for reaching out! We'll get back to you shortly. 🙏";
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      }),
    });
    const aiData = await aiRes.json();
    if (aiData.content?.[0]?.text) aiReply = aiData.content[0].text;
  } catch (err) {
    console.error("Claude error:", err.message);
  }

  // Send reply via Twilio
  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: fromNumber,
      to: fromWhatsApp,
      body: aiReply,
    });
  } catch (err) {
    console.error("Twilio send error:", err.message);
  }

  // Respond to Twilio's webhook with empty TwiML (required, even though we already sent via REST API above)
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");
}
