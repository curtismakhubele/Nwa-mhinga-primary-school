"use strict";
const crypto = require("node:crypto");

const apiVersion = /^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION || "")
  ? process.env.WHATSAPP_API_VERSION : "v27.0";
const seenMessages = new Map();

const faq = [
  { keys: ["admission", "apply", "application", "enrol", "enroll", "register child"], text: "To apply, open the N'wa Mhinga school portal, choose Admissions, and create a parent account first. Sign in with that same ID/passport and password to submit, view, or amend an application." },
  { keys: ["track", "check application", "status", "amend", "edit application", "rejected"], text: "Open Admissions and sign in with the ID/passport and password you used when applying. Your application status and school messages are in your parent workspace. Rejected applications can be corrected and resubmitted there." },
  { keys: ["grade", "grades", "grade r", "school level"], text: "N'wa Mhinga Primary School serves Grade R through Grade 7." },
  { keys: ["address", "location", "directions", "map", "where"], text: "The school is at Ntsu Street and Ramosa Street, Saulsville, Pretoria, 0125. Directions: https://www.google.com/maps/dir/?api=1&destination=-25.77897%2C28.05932" },
  { keys: ["phone", "call", "contact", "telephone", "whatsapp"], text: "Call the school on 012 375 5514, or message us on WhatsApp at 084 214 5174." },
  { keys: ["media", "lesson", "video", "image", "document", "learning resource"], text: "Open Media & Lessons on the school portal to view published learning resources. Sign in with your school account if prompted." },
  { keys: ["privacy", "personal information", "learner information", "my child", "records", "id number"], text: "This chatbot cannot view or discuss private learner or guardian records. Please do not send ID numbers or application documents here. Sign in to the parent workspace for your application, or contact the school." },
  { keys: ["password", "sign in", "login", "log in", "credential"], text: "For an admission, use the ID/passport and password from your parent account. For a school staff account, sign in with the credentials issued by the school administrator." }
];

function config() {
  return {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    apiVersion
  };
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function verifyWebhook(req, res) {
  const { verifyToken } = config();
  if (!verifyToken) return res.status(503).type("text/plain").send("WhatsApp webhook is not configured.");
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && sameSecret(token, verifyToken) && challenge) return res.status(200).type("text/plain").send(String(challenge));
  return res.sendStatus(403);
}

function answer(text) {
  const normalized = String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  if (/\b\d{13}\b/.test(String(text)) || /\bNMP-\d{4}-\d{5}\b/i.test(String(text)) || /\b(application|admission)\s*(number|reference)\b/.test(normalized)) {
    return "For privacy, please do not send ID numbers or application references in WhatsApp. Sign in to the Admissions page to view your own application: https://nwa-mhinga-primary-school.azurewebsites.net/admissions.html";
  }
  const match = faq.find(item => item.keys.some(key => normalized.includes(key)));
  return match ? match.text : "I can help with applications, application status, grades, school location, contact details and learning resources. Call the school on 012 375 5514 for other questions.";
}

async function sendText(to, body) {
  const { accessToken, phoneNumberId, apiVersion } = config();
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp sender credentials are not configured.");
  const response = await fetch("https://graph.facebook.com/" + apiVersion + "/" + encodeURIComponent(phoneNumberId) + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("WhatsApp Cloud API returned HTTP " + response.status + ".");
}

function remember(id) {
  if (seenMessages.has(id)) return false;
  seenMessages.set(id, Date.now());
  if (seenMessages.size > 2000) seenMessages.delete(seenMessages.keys().next().value);
  return true;
}

async function processPayload(body) {
  const messages = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) messages.push(message);
    }
  }
  for (const message of messages.slice(0, 20)) {
    if (!message.id || !message.from || !remember(message.id)) continue;
    const text = message.type === "text" ? message.text?.body : "";
    const response = text
      ? answer(text)
      : "I can answer text questions about admissions, school contact details, location and learning resources. Please send your question as text.";
    try {
      await sendText(message.from, response);
    } catch (error) {
      console.error("WhatsApp reply failed:", error.message);
    }
  }
}

function receiveWebhook(req, res) {
  const { appSecret } = config();
  if (!appSecret) return res.status(503).json({ error: "WhatsApp webhook signature verification is not configured." });
  const signature = String(req.get("x-hub-signature-256") || "");
  const providedHex = signature.startsWith("sha256=") ? signature.slice(7) : "";
  if (!/^[a-f0-9]{64}$/i.test(providedHex)) return res.sendStatus(401);
  const expected = crypto.createHmac("sha256", appSecret).update(req.rawBody || Buffer.alloc(0)).digest();
  const provided = Buffer.from(providedHex, "hex");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return res.sendStatus(401);
  const payload = req.body;
  res.sendStatus(200);
  setImmediate(() => processPayload(payload).catch(error => console.error("WhatsApp webhook processing failed:", error.message)));
}

function status(_req, res) {
  const { verifyToken, appSecret, accessToken, phoneNumberId } = config();
  res.set("Cache-Control", "no-store");
  res.json({ configured: Boolean(verifyToken && appSecret && accessToken && phoneNumberId) });
}

module.exports = { verifyWebhook, receiveWebhook, status };

