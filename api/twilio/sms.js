// api/twilio/sms.js — Twilio SMS webhook
//
// Same pattern as the WhatsApp webhook, but for plain SMS. Useful for merchants
// whose customers don't use WhatsApp, or for OTP/order-update fallback.
//
// SETUP REQUIRED (Vercel environment variables):
//   TWILIO_ACCOUNT_SID    - from twilio.com/console
//   TWILIO_AUTH_TOKEN     - from twilio.com/console
//   TWILIO_SMS_NUMBER     - your Twilio SMS-capable phone number, format: +14155238886
//   ANTHROPIC_API_KEY     - already set for the chat AI
//
// Twilio webhook configuration (in Twilio Console → Phone Numbers → your number):
//   Set "A message comes in" webhook to: https://yourdomain.com/api/twilio/sms
//   Method: POST

export const config = { runtime: "nodejs" };

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Twilio environment variables not configured");
    res.status(500).send("Server not configured");
    return;
  }

  const body = req.body || {};
  const userText = body.Body;
  const fromPhone = body.From;

  if (!userText || !fromPhone) {
    res.status(200).send("OK");
    return;
  }

  const systemPrompt = process.env.AGENT_SYSTEM_PROMPT || `You are CartChat, a friendly AI SMS assistant for an online store.
Be warm and very concise — SMS has a 160-character-friendly style, avoid long paragraphs.
Help with order tracking, product questions, and basic support. Respond in the customer's language.`;

  let aiReply = "Thanks for your message! We'll get back to you shortly.";
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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      }),
    });
    const aiData = await aiRes.json();
    if (aiData.content?.[0]?.text) aiReply = aiData.content[0].text;
  } catch (err) {
    console.error("Claude error:", err.message);
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: fromNumber,
      to: fromPhone,
      body: aiReply,
    });
  } catch (err) {
    console.error("Twilio SMS send error:", err.message);
  }

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");
}
