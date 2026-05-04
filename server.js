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

app.post("/generate", async (req, res) => {
  const { name, businessName, reviewLink, language } = req.body;
  const langName = language === "nl" ? "Dutch" : language === "fr" ? "French" : "English";
  const optOut = language === "nl" ? "Antwoord STOP om te stoppen." : language === "fr" ? "Repondez STOP pour vous desabonner." : "Reply STOP to unsubscribe.";
  const system = `You are ReviewNow. Write a SHORT warm personalised ${langName} WhatsApp/SMS review request for ${name} who just used ${businessName}. Max 300 chars. Include: ${reviewLink || "https://g.page/r/example"}. End with ${optOut} Return ONLY the message.`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages: [{ role: "user", content: `Review request for ${name}` }] })
    });
    cons
