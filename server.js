const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "reviewnow-agent.html")));
app.get("/health", (req, res) => res.json({ status: "ReviewNow backend running" }));

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
    res.json({ success: true, sid: msg.sid, status: msg.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("ReviewNow backend running on port " + PORT));
