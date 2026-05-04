const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Boot-time sanity check so misconfiguration is obvious in Render logs
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[BOOT] WARNING: ANTHROPIC_API_KEY is NOT set. /generate will fail.");
} else {
  console.log("[BOOT] ANTHROPIC_API_KEY is set (length " + process.env.ANTHROPIC_API_KEY.length + ").");
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "reviewnow-agent.html")));
app.get("/health", (req, res) => res.json({
  status: "ReviewNow backend running",
  anthropicKey: process.env.ANTHROPIC_API_KEY ? "set" : "missing"
}));

app.post("/generate", async (req, res) => {
  const { name, businessName, reviewLink, language } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY env var" });
  }
  if (!name || !businessName) {
    return res.status(400).json({ error: "Missing required fields: name, businessName" });
  }

  const lang = language === "nl" ? "Dutch" : language === "fr" ? "French" : "English";
  const optOut = language === "nl"
    ? "Antwoord STOP om te stoppen."
    : language === "fr"
    ? "Repondez STOP pour vous desabonner."
    : "Reply STOP to unsubscribe.";
  const system = `You are ReviewNow. Write a SHORT warm personalised ${lang} WhatsApp/SMS review request for ${name} who just used ${businessName}. Max 300 chars. Include: ${reviewLink || "https://g.page/r/example"}. End with ${optOut} Return ONLY the message.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: "Write the message" }]
      })
    });

    const d = await r.json();

    // Surface Anthropic errors instead of silently returning ""
    if (!r.ok) {
      console.error("[/generate] Anthropic API error", r.status, d);
      return res.status(r.status).json({
        error: "Anthropic API error",
        status: r.status,
        details: d
      });
    }

    const text = d?.content?.[0]?.text?.trim();
    if (!text) {
      console.error("[/generate] Unexpected response shape", d);
      return res.status(502).json({ error: "Empty response from Anthropic", details: d });
    }

    res.json({ message: text });
  } catch (e) {
    console.error("[/generate] fetch failed", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/send", async (req, res) => {
  const { to, message, channel, twilioSid, twilioToken, twilioFrom } = req.body;
  if (!to || !message || !twilioSid || !twilioToken || !twilioFrom) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const client = twilio(twilioSid, twilioToken);
    const toF = channel === "whatsapp" ? "whatsapp:" + to : to;
    const fromF = channel === "whatsapp"
      ? (twilioFrom.startsWith("whatsapp:") ? twilioFrom : "whatsapp:" + twilioFrom)
      : twilioFrom;
    const msg = await client.messages.create({ body: message, to: toF, from: fromF });
    res.json({ success: true, sid: msg.sid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("ReviewNow backend running on port " + PORT));
