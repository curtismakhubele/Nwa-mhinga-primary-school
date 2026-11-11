"use strict";
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();
const port = Number(process.env.PORT || 8080);
const siteRoot = __dirname;
const dataRoot = process.env.SCHOOL_DATA_DIR || path.join(siteRoot, ".school-data");
const mediaRoot = path.join(dataRoot, "school-media");
const statePath = path.join(dataRoot, "school-content.json");
const maximumFileBytes = 50 * 1024 * 1024;
const totalMediaLimitBytes = Number(process.env.SCHOOL_MEDIA_LIMIT_BYTES || 600 * 1024 * 1024);
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "application/pdf"]);
const mediaKinds = new Set(["Photo", "Video", "Audio", "Document", "Lesson", "Announcement", "News"]);
let state = { items: [], schoolData: null, admissions: [] };
let writeQueue = Promise.resolve();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "10mb" }));

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}
function cookieValue(req, name) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}
function currentAdmin(req) {
  const token = cookieValue(req, "nwa_admin_session");
  const entry = sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  entry.expiresAt = Date.now() + sessionLifetimeMs;
  return entry;
}
function requireAdmin(req, res, next) {
  if (!currentAdmin(req)) return sendError(res, 401, "Administrator sign-in required.");
  next();
}
async function saveState() {
  writeQueue = writeQueue.then(async () => {
    const tmp = statePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(tmp, statePath);
  });
  return writeQueue;
}
async function directoryBytes(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const stat = await fs.stat(path.join(dir, entry.name));
    total += stat.size;
  }
  return total;
}
function safePublicItem(item) {
  const { id, type, title, description, filename, mimeType, size, createdAt, published, grade, subject, teacher, lessonDate } = item;
  return { id, type, title, description, filename, mimeType, size, createdAt, published, grade, subject, teacher, lessonDate, fileUrl: item.filename ? "/api/media/" + encodeURIComponent(id) : "" };
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: maximumFileBytes, files: 1, fields: 8, fieldSize: 16 * 1024 }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", storageLimitBytes: totalMediaLimitBytes }));
app.get("/api/admin/session", (req, res) => {
  const admin = currentAdmin(req);
  res.json({ authenticated: !!admin, email: admin?.email || null });
});
app.post("/api/admin/login", (req, res) => {
  const configuredEmail = (process.env.SCHOOL_ADMIN_EMAIL || "").trim().toLowerCase();
  const configuredPassword = String(process.env.SCHOOL_ADMIN_PASSWORD || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  if (!configuredEmail || !configuredPassword) {
    return sendError(res, 503, "Admin sign-in is not configured. Set SCHOOL_ADMIN_EMAIL and SCHOOL_ADMIN_PASSWORD in App Service settings.");
  }
  const provided = Buffer.from(password);
  const expected = Buffer.from(configuredPassword);
  const equalPassword = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (email !== configuredEmail || !equalPassword) return sendError(res, 401, "Invalid administrator credentials. Use the exact SCHOOL_ADMIN_EMAIL and SCHOOL_ADMIN_PASSWORD saved in this App Service, then restart the app if you recently changed them.");
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { email, expiresAt: Date.now() + sessionLifetimeMs });
  res.setHeader("Set-Cookie", "nwa_admin_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + Math.floor(sessionLifetimeMs / 1000));
  res.json({ authenticated: true, email, role: "Admin" });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const token = cookieValue(req, "nwa_admin_session");
  sessions.delete(token);
  res.setHeader("Set-Cookie", "nwa_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  res.json({ ok: true });
});

// Shared school records for the F1 prototype. This is persistent app storage, not a database.
app.get("/api/admin/data", requireAdmin, (_req, res) => res.json(state.schoolData ? { ...state.schoolData, initialized: true } : { initialized: false }));
app.put("/api/admin/data", requireAdmin, async (req, res, next) => {
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const clean = {};
    for (const key of ["learners", "assessments", "learnerAttendance", "learnerReports", "docs"]) {
      if (!Array.isArray(input[key])) return sendError(res, 400, "School data must include valid record lists.");
      clean[key] = input[key];
    }
    if (JSON.stringify(clean).length > 6 * 1024 * 1024) return sendError(res, 413, "School records exceed the F1 data limit.");
    state.schoolData = clean;
    await saveState();
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});
app.get("/api/admin/admissions", requireAdmin, (_req, res) => res.json({ items: state.admissions || [] }));
app.post("/api/public/admissions", async (req, res, next) => {
  try {
    const record = req.body;
    if (!record || !/^NMP-\d{4}-\d{5}$/.test(String(record.reference || "")) || !record.learner?.fullName || !record.application || typeof record.application !== "object") return sendError(res, 400, "The application is incomplete.");
    const serialized = JSON.stringify(record);
    if (serialized.length > 8 * 1024 * 1024) return sendError(res, 413, "Application is too large. Save fewer/smaller documents and retry.");
    const admissions = Array.isArray(state.admissions) ? state.admissions : [];
    if (Buffer.byteLength(JSON.stringify(admissions)) + Buffer.byteLength(serialized) > 80 * 1024 * 1024) return sendError(res, 413, "The school application storage quota is full.");
    if (admissions.some(x => x.reference === record.reference)) return sendError(res, 409, "This application reference was already submitted.");
    const saved = { ...record, status: "Received by school", receivedAt: new Date().toISOString() };
    admissions.unshift(saved);
    state.admissions = admissions;
    await saveState();
    res.status(201).json({ reference: saved.reference, status: saved.status, receivedAt: saved.receivedAt });
  } catch (err) { next(err); }
});

app.get("/api/public/media", async (_req, res, next) => {
  try {
    const items = state.items.filter(x => x.published).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const used = await directoryBytes(mediaRoot);
    res.json({ items: items.map(safePublicItem), usedBytes: used, limitBytes: totalMediaLimitBytes });
  } catch (err) { next(err); }
});
app.get("/api/admin/media", requireAdmin, async (_req, res, next) => {
  try {
    const used = await directoryBytes(mediaRoot);
    res.json({ items: state.items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(safePublicItem), usedBytes: used, limitBytes: totalMediaLimitBytes });
  } catch (err) { next(err); }
});
app.post("/api/admin/media", requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    const type = String(req.body.type || "");
    const title = String(req.body.title || "").trim().slice(0, 120);
    const description = String(req.body.description || "").trim().slice(0, 1000);
    const published = req.body.published !== "false";
    if (!title || !mediaKinds.has(type)) {
      if (req.file) req.file = null;
      return sendError(res, 400, "Enter a title and choose a valid post type.");
    }
    if (["Photo", "Video", "Audio", "Document", "Lesson"].includes(type) && !req.file) return sendError(res, 400, "Choose a file to upload.");
    if (["Announcement", "News"].includes(type) && req.file && !allowedTypes.has(req.file.mimetype)) return sendError(res, 415, "This file type is not supported.");
    if (req.file && !allowedTypes.has(req.file.mimetype)) return sendError(res, 415, "Use JPG, PNG, WEBP, MP4, WEBM, or PDF.");
    const grade = String(req.body.grade || "").trim().slice(0, 20);
    const subject = String(req.body.subject || "").trim().slice(0, 80);
    const teacher = String(req.body.teacher || "").trim().slice(0, 100);
    const lessonDate = String(req.body.lessonDate || "").trim().slice(0, 10);
    if (type === "Lesson" && (!grade || !subject || !/^\d{4}-\d{2}-\d{2}$/.test(lessonDate))) return sendError(res, 400, "Choose a grade, subject, and lesson date.");
    const used = await directoryBytes(mediaRoot);
    if (req.file && used + req.file.size > totalMediaLimitBytes) return sendError(res, 413, "The F1 media storage limit is full. Remove old media or use external storage.");
    const id = crypto.randomUUID();
    let filename = "";
    if (req.file) {
      const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/webm": ".weba", "audio/ogg": ".ogg", "audio/wav": ".wav", "application/pdf": ".pdf" })[req.file.mimetype];
      filename = id + ext;
      await fs.writeFile(path.join(mediaRoot, filename), req.file.buffer, { flag: "wx", mode: 0o600 });
    }
    const item = { id, type, title, description, grade, subject, teacher, lessonDate, filename, mimeType: req.file?.mimetype || "", size: req.file?.size || 0, createdAt: new Date().toISOString(), published };
    state.items.unshift(item);
    await saveState();
    res.status(201).json(safePublicItem(item));
  } catch (err) { next(err); }
});
app.delete("/api/admin/media/:id", requireAdmin, async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id);
    if (!item) return sendError(res, 404, "Post not found.");
    state.items = state.items.filter(x => x.id !== item.id);
    await saveState();
    if (item.filename) await fs.rm(path.join(mediaRoot, item.filename), { force: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.get("/api/media/:id", async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id && x.published && x.filename);
    if (!item) return res.sendStatus(404);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=300");
    if (item.type === "Lesson" && item.mimeType === "application/pdf") res.setHeader("Content-Disposition", "inline; filename=\"" + path.basename(item.filename) + "\"");
    res.type(item.mimeType);
    res.sendFile(path.join(mediaRoot, item.filename));
  } catch (err) { next(err); }
});

app.use("/api", (_req, res) => sendError(res, 404, "API route not found."));
app.use(express.static(siteRoot, { dotfiles: "deny", index: "index.html" }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(siteRoot, "index.html")));
app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  const status = err instanceof multer.MulterError ? 413 : 500;
  res.status(status).json({ error: status === 413 ? "Upload exceeds the 50 MB file limit." : "The request could not be completed." });
});

async function start() {
  await fs.mkdir(mediaRoot, { recursive: true, mode: 0o700 });
  try { state = JSON.parse(await fs.readFile(statePath, "utf8")); }
  catch (err) { if (err.code !== "ENOENT") throw err; await saveState(); }
  if (!Array.isArray(state.items)) state.items = [];
  if (!Array.isArray(state.admissions)) state.admissions = [];
  if (!state.schoolData || typeof state.schoolData !== "object") state.schoolData = null;
  app.listen(port, "0.0.0.0", () => console.log("N'wa Mhinga portal listening on port " + port));
}
start().catch(err => { console.error("Startup failed:", err.message); process.exit(1); });

