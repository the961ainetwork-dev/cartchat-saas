// api/twilio/voice.js — Twilio Voice webhook
//
// Handles incoming phone calls with an AI-driven voice assistant:
// 1. Greets the caller and asks them to speak their question
// 2. Twilio transcribes their speech and POSTs it back to this same endpoint
// 3. Claude generates a spoken-friendly reply
// 4. Twilio speaks the reply back using text-to-speech, then listens again
//
// SETUP REQUIRED (Vercel environment variables):
//   ANTHROPIC_API_KEY     - already set for the chat AI
//   (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not needed here — Twilio calls
//    this endpoint directly and we just respond with TwiML/XML, no outbound
//    REST call needed for voice)
//
// Twilio webhook configuration (in Twilio Console → Phone Numbers → your number):
//   Set "A call comes in" webhook to: https://yourdomain.com/api/twilio/voice
//   Method: POST

export const config = { runtime: "nodejs" };

function escapeXml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const body = req.body || {};
  const speechResult = body.SpeechResult; // present only after the caller has spoken

  res.setHeader("Content-Type", "text/xml");

  // ── First call into this number: greet and start listening ──────────────────
  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/api/twilio/voice" method="POST" speechTimeout="auto" language="en-US">
    <Say voice="Polly.Joanna">Hi! Thanks for calling. How can I help you today?</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I didn't catch that. Please call back. Goodbye.</Say>
</Response>`;
    res.status(200).send(twiml);
    return;
  }

  // ── Caller has spoken: send their speech to Claude, speak the reply ──────────
  const systemPrompt = process.env.AGENT_SYSTEM_PROMPT || `You are a friendly AI phone assistant for an online store.
Keep replies SHORT (1-2 sentences) and conversational — this will be read aloud by text-to-speech.
Help with order tracking, product questions, and basic support.`;

  let aiReply = "I'm sorry, I'm having trouble right now. Please try again later.";
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
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: speechResult }],
      }),
    });
    const aiData = await aiRes.json();
    if (aiData.content?.[0]?.text) aiReply = aiData.content[0].text;
  } catch (err) {
    console.error("Claude error:", err.message);
  }

  // Continue the conversation: speak the reply, then listen again
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/api/twilio/voice" method="POST" speechTimeout="auto" language="en-US">
    <Say voice="Polly.Joanna">${escapeXml(aiReply)}</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling. Goodbye!</Say>
</Response>`;
  res.status(200).send(twiml);
}
