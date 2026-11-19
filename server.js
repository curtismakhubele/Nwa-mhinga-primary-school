"use strict";
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");
const sharp = require("sharp");

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
const extensionMimeTypes = {
  ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif",".avif":"image/avif",".bmp":"image/bmp",".tif":"image/tiff",".tiff":"image/tiff",".heic":"image/heic",".heif":"image/heif",".svg":"image/svg+xml",
  ".mp4":"video/mp4",".m4v":"video/mp4",".webm":"video/webm",".ogv":"video/ogg",".mov":"video/quicktime",".mkv":"video/x-matroska",".avi":"video/x-msvideo",".wmv":"video/x-ms-wmv",".asf":"video/x-ms-asf",".flv":"video/x-flv",".mpg":"video/mpeg",".mpeg":"video/mpeg",".m2v":"video/mpeg",".vob":"video/mpeg",".3gp":"video/3gpp",".3g2":"video/3gpp2",".ts":"video/mp2t",".mts":"video/mp2t",".m2ts":"video/mp2t",
  ".mp3":"audio/mpeg",".m4a":"audio/mp4",".aac":"audio/aac",".wav":"audio/wav",".flac":"audio/flac",".ogg":"audio/ogg",".oga":"audio/ogg",".weba":"audio/webm",
  ".pdf":"application/pdf",".doc":"application/msword",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",".docm":"application/vnd.ms-word.document.macroEnabled.12",
  ".xls":"application/vnd.ms-excel",".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",".xlsm":"application/vnd.ms-excel.sheet.macroEnabled.12",
  ".ppt":"application/vnd.ms-powerpoint",".pptx":"application/vnd.openxmlformats-officedocument.presentationml.presentation",".pptm":"application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  ".odt":"application/vnd.oasis.opendocument.text",".ods":"application/vnd.oasis.opendocument.spreadsheet",".odp":"application/vnd.oasis.opendocument.presentation",
  ".rtf":"application/rtf",".txt":"text/plain",".csv":"text/csv"
};
const allowedTypes = new Set(Object.values(extensionMimeTypes));
const mediaKinds = new Set(["Photo", "Video", "Audio", "Document", "Lesson", "Announcement", "News"]);
let state = { items: [], schoolData: null, admissions: [], users: [] };
let writeQueue = Promise.resolve();
const previewJobs = new Map();

function appSetting(name) {
  const direct = process.env[name];
  if (typeof direct === "string" && direct.length > 0) return direct;

  // App Service prefixes values stored under its Connection strings blade.
  const prefixes = ["CUSTOMCONNSTR_", "SQLCONNSTR_", "SQLAZURECONNSTR_", "MYSQLCONNSTR_", "POSTGRESQLCONNSTR_", "DOCDBCONNSTR_", "REDISCACHECONNSTR_", "SERVICEBUSCONNSTR_", "EVENTHUBCONNSTR_", "NOTIFICATIONHUBCONNSTR_"];
  const expected = new Set(prefixes.map(prefix => (prefix + name).toUpperCase()));
  const entry = Object.entries(process.env).find(([key, value]) => expected.has(key.toUpperCase()) && typeof value === "string" && value.length > 0);
  return entry ? entry[1] : "";
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // The existing portal controls, including Login, use inline onclick handlers.
      scriptSrcAttr: ["'unsafe-inline'"],
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
function currentUser(req) {
  const token = cookieValue(req, "nwa_admin_session");
  const entry = sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  entry.expiresAt = Date.now() + sessionLifetimeMs;
  return entry;
}
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return sendError(res, 401, "Sign-in required.");
  req.schoolUser = user.user;
  next();
}
function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return sendError(res, 401, "Administrator sign-in required.");
  if (user.user.role !== "Admin") return sendError(res, 403, "Administrator access required.");
  req.schoolUser = user.user;
  next();
}
function requireSchoolManager(req, res, next) {
  const user = currentUser(req);
  if (!user) return sendError(res, 401, "School account sign-in required.");
  if (!["Admin", "Principal"].includes(user.user.role)) return sendError(res, 403, "Principal or administrator access required.");
  req.schoolUser = user.user;
  next();
}
function requireParent(req, res, next) {
  const user = currentUser(req);
  if (!user) return sendError(res, 401, "Parent account sign-in required.");
  if (user.user.role !== "Parent") return sendError(res, 403, "Sign in with a parent or guardian account.");
  req.schoolUser = user.user;
  next();
}
const userRoles = new Set(["Admin", "Principal", "Vice Principal", "Teacher", "Parent", "Learner"]);
function publicUser(user) {
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function passwordMatches(password, user) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const actual = crypto.scryptSync(password, user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
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
  const { id, type, title, description, filename, originalName, mimeType, size, createdAt, published, grade, subject, teacher, lessonDate } = item;
  const mediaUrl = item.filename ? "/api/media/" + encodeURIComponent(id) : "";
  return {
    id, type, title, description, filename, originalName, mimeType, size, createdAt, published, grade, subject, teacher, lessonDate,
    fileUrl: mediaUrl,
    previewUrl: mediaUrl && String(mimeType || "").startsWith("image/") ? mediaUrl + "/preview" : "",
    previewVideoUrl: mediaUrl && String(mimeType || "").startsWith("video/") ? mediaUrl + "/preview-video" : "",
    posterUrl: mediaUrl && String(mimeType || "").startsWith("video/") ? mediaUrl + "/poster" : ""
  };
}
function uploadedMimeType(file) {
  const supplied = String(file.mimetype || "").toLowerCase();
  if (allowedTypes.has(supplied)) return supplied;
  return extensionMimeTypes[path.extname(String(file.originalname || "")).toLowerCase()] || "";
}
function runFfmpeg(args, timeoutMs = 240000) {
  if (!ffmpegPath) return Promise.reject(new Error("Video preview encoder is unavailable."));
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let errorOutput = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", chunk => { errorOutput = (errorOutput + chunk.toString()).slice(-2000); });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("close", code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(errorOutput || "Video preview conversion failed."));
    });
  });
}
async function ensureVideoPreview(item) {
  if (item.previewVideoFilename) {
    try {
      await fs.access(path.join(mediaRoot, item.previewVideoFilename));
      return item;
    } catch {}
  }
  if (previewJobs.has(item.id)) return previewJobs.get(item.id);
  const job = (async () => {
    const source = path.join(mediaRoot, item.filename);
    const videoName = item.id + "-preview.mp4";
    const posterName = item.id + "-poster.jpg";
    const videoPath = path.join(mediaRoot, videoName);
    const posterPath = path.join(mediaRoot, posterName);
    await runFfmpeg([
      "-i", source, "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "29", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-threads", "1", "-movflags", "+faststart", "-f", "mp4", videoPath
    ]);
    try {
      await runFfmpeg(["-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", "scale=960:540:force_original_aspect_ratio=decrease", "-q:v", "4", posterPath]);
      item.previewPosterFilename = posterName;
    } catch (err) {
      await fs.rm(posterPath, { force: true });
      console.warn("Video poster generation skipped:", err.message);
    }
    if (await directoryBytes(mediaRoot) > totalMediaLimitBytes) {
      await Promise.all([fs.rm(videoPath, { force: true }), fs.rm(posterPath, { force: true })]);
      delete item.previewVideoFilename;
      delete item.previewPosterFilename;
      throw new Error("There is not enough school media storage to create a video preview. Remove older media and retry.");
    }
    item.previewVideoFilename = videoName;
    return item;
  })().finally(() => previewJobs.delete(item.id));
  previewJobs.set(item.id, job);
  return job;
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: maximumFileBytes, files: 1, fields: 8, fieldSize: 16 * 1024 }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", storageLimitBytes: totalMediaLimitBytes }));
app.get("/api/admin/session", (req, res) => {
  const user = currentUser(req);
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: !!user, user: user ? publicUser(user.user) : null });
});
app.post("/api/admin/login", (req, res) => {
  const configuredAdmins = [
    { email: appSetting("SCHOOL_ADMIN_EMAIL").trim().toLowerCase(), password: appSetting("SCHOOL_ADMIN_PASSWORD").trim() },
    { email: appSetting("SCHOOL_ADMIN_TEST_EMAIL").trim().toLowerCase(), password: appSetting("SCHOOL_ADMIN_TEST_PASSWORD").trim() }
  ].filter(admin => admin.email && admin.password);
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!configuredAdmins.length && !Array.isArray(state.users)) {
    return sendError(res, 503, "Admin sign-in is not configured. Add administrator credentials in App Service settings.");
  }
  const provided = Buffer.from(password);
  const matchedAdmin = configuredAdmins.find(admin => {
    const expected = Buffer.from(admin.password);
    const equalPassword = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    return email === admin.email && equalPassword;
  });
  const account = matchedAdmin ? null : (state.users || []).find(user => user.email === email && user.status === "Active" && passwordMatches(password, user));
  if (!matchedAdmin && !account) return sendError(res, 401, "Invalid email or password, or this account is inactive.");
  const signedInUser = account ? publicUser(account) : {
    id: "server-admin", name: "School Administrator", email: matchedAdmin.email, role: "Admin",
    assignedGrade: "All", assignedClass: "All", status: "Active"
  };
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { user: signedInUser, expiresAt: Date.now() + sessionLifetimeMs });
  res.setHeader("Set-Cookie", "nwa_admin_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + Math.floor(sessionLifetimeMs / 1000));
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: true, user: signedInUser });
});
app.post("/api/public/parent/register", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 256) return sendError(res, 400, "Enter your name, a valid email, and a password of at least 8 characters.");
    if ((state.users || []).some(user => user.email === email) || [appSetting("SCHOOL_ADMIN_EMAIL"), appSetting("SCHOOL_ADMIN_TEST_EMAIL")].some(value => value.trim().toLowerCase() === email)) return sendError(res, 409, "An account with this email already exists. Sign in instead.");
    const { salt, hash } = hashPassword(password);
    const user = { id: "U" + crypto.randomBytes(6).toString("hex"), name, email, role: "Parent", status: "Active", assignedGrade: "All", assignedClass: "All", learnerId: "", passwordSalt: salt, passwordHash: hash };
    state.users = [...(state.users || []), user];
    await saveState();
    const safe = publicUser(user), token = crypto.randomBytes(32).toString("base64url");
    sessions.set(token, { user: safe, expiresAt: Date.now() + sessionLifetimeMs });
    res.setHeader("Set-Cookie", "nwa_admin_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + Math.floor(sessionLifetimeMs / 1000));
    res.set("Cache-Control", "no-store");
    res.status(201).json({ user: safe });
  } catch (err) { next(err); }
});
app.post("/api/public/parent/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = (state.users || []).find(row => row.email === email && row.role === "Parent" && row.status === "Active" && passwordMatches(password, row));
  if (!user) return sendError(res, 401, "Invalid parent account email or password.");
  const safe = publicUser(user), token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { user: safe, expiresAt: Date.now() + sessionLifetimeMs });
  res.setHeader("Set-Cookie", "nwa_admin_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + Math.floor(sessionLifetimeMs / 1000));
  res.set("Cache-Control", "no-store");
  res.json({ user: safe });
});
app.get("/api/public/parent/session", requireParent, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ user: req.schoolUser });
});
app.post("/api/admin/logout", requireAuth, (req, res) => {
  const token = cookieValue(req, "nwa_admin_session");
  sessions.delete(token);
  res.setHeader("Set-Cookie", "nwa_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ users: (state.users || []).map(publicUser) });
});
app.post("/api/admin/users/migrate", requireAdmin, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.users) ? req.body.users.slice(0, 250) : [];
    const existing = new Set((state.users || []).map(user => user.email));
    let imported = 0, skipped = 0;
    for (const row of rows) {
      const email = String(row.email || "").trim().toLowerCase();
      const name = String(row.name || "").trim();
      const password = String(row.password || "");
      if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !userRoles.has(row.role) || !["Active", "Suspended"].includes(row.status) || password.length < 8 || password.length > 256 || existing.has(email)) { skipped++; continue; }
      const { salt, hash } = hashPassword(password);
      state.users.push({ id: "U" + crypto.randomBytes(6).toString("hex"), name, email, role: row.role, status: row.status, assignedGrade: String(row.assignedGrade || "All"), assignedClass: String(row.assignedClass || "All"), learnerId: String(row.learnerId || ""), passwordSalt: salt, passwordHash: hash });
      existing.add(email); imported++;
    }
    if (imported) await saveState();
    res.json({ imported, skipped, users: (state.users || []).map(publicUser) });
  } catch (err) { next(err); }
});
app.post("/api/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const input = req.body || {};
    const email = String(input.email || "").trim().toLowerCase();
    const name = String(input.name || "").trim();
    const password = String(input.password || "");
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !userRoles.has(input.role) || !["Active", "Suspended"].includes(input.status) || password.length < 8 || password.length > 256) return sendError(res, 400, "Enter a name, valid email, role, status, and password of at least 8 characters.");
    if ((state.users || []).some(user => user.email === email)) return sendError(res, 409, "An account with this email already exists.");
    const { salt, hash } = hashPassword(password);
    const user = { id: "U" + crypto.randomBytes(6).toString("hex"), name, email, role: input.role, status: input.status, assignedGrade: String(input.assignedGrade || "All"), assignedClass: String(input.assignedClass || "All"), learnerId: String(input.learnerId || ""), passwordSalt: salt, passwordHash: hash };
    state.users = [...(state.users || []), user];
    await saveState();
    res.status(201).json({ user: publicUser(user) });
  } catch (err) { next(err); }
});
app.patch("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = (state.users || []).find(row => row.id === req.params.id);
    if (!user) return sendError(res, 404, "Account not found.");
    const input = req.body || {};
    const email = String(input.email || "").trim().toLowerCase();
    const name = String(input.name || "").trim();
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !userRoles.has(input.role) || !["Active", "Suspended"].includes(input.status)) return sendError(res, 400, "Account details are invalid.");
    if ((state.users || []).some(row => row.id !== user.id && row.email === email)) return sendError(res, 409, "An account with this email already exists.");
    const password = input.password === undefined ? "" : String(input.password);
    if (password && (password.length < 8 || password.length > 256)) return sendError(res, 400, "Password must be at least 8 characters.");
    Object.assign(user, { name, email, role: input.role, status: input.status, assignedGrade: String(input.assignedGrade || "All"), assignedClass: String(input.assignedClass || "All"), learnerId: String(input.learnerId || "") });
    if (password) {
      const { salt, hash } = hashPassword(password);
      user.passwordSalt = salt; user.passwordHash = hash;
    }
    await saveState();
    for (const [token, session] of sessions) if (session.user.id === req.params.id) sessions.delete(token);
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});
app.delete("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.schoolUser.id) return sendError(res, 400, "You cannot remove your own account.");
    const before = state.users || [];
    state.users = before.filter(user => user.id !== req.params.id);
    if (state.users.length === before.length) return sendError(res, 404, "Account not found.");
    await saveState();
    for (const [token, session] of sessions) if (session.user.id === req.params.id) sessions.delete(token);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post("/api/account/password", requireAuth, async (req, res, next) => {
  try {
    const user = (state.users || []).find(row => row.id === req.schoolUser.id);
    if (!user) return sendError(res, 400, "This administrator password is managed in Azure App Service settings.");
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!passwordMatches(currentPassword, user)) return sendError(res, 401, "Current password is incorrect.");
    if (newPassword.length < 8 || newPassword.length > 256) return sendError(res, 400, "New password must be at least 8 characters.");
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt; user.passwordHash = hash;
    await saveState();
    for (const [token, session] of sessions) if (session.user.id === user.id) sessions.delete(token);
    res.set("Set-Cookie", "nwa_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Remove only the known bundled sample rows from existing app storage.
function cleanLegacyDemoSchoolData(data) {
  const learners = new Set(["L001", "L002", "L003", "L004", "L005", "L006", "L007", "L008", "L009"]);
  const assessments = new Set(["A001", "A002", "A003", "A004"]);
  const docs = new Set(["D001", "D002"]);
  const clean = { ...data };
  for (const key of ["learners", "assessments", "learnerAttendance", "learnerReports", "docs"]) {
    clean[key] = Array.isArray(data[key]) ? data[key] : [];
  }
  clean.learners = clean.learners.filter(row => !learners.has(row.id));
  clean.assessments = clean.assessments.filter(row => !assessments.has(row.id) && !learners.has(row.learnerId));
  clean.learnerAttendance = clean.learnerAttendance.filter(row => !learners.has(row.learnerId));
  clean.learnerReports = clean.learnerReports.filter(row => !learners.has(row.learnerId));
  clean.docs = clean.docs.filter(row => !docs.has(row.id));
  return clean;
}
// Shared school records for the F1 prototype. This is persistent app storage, not a database.
function learnerInUserScope(learner, user) {
  if (["Admin", "Principal"].includes(user.role)) return true;
  if (user.role === "Vice Principal") {
    if (user.assignedGrade === "All") return true;
    if (user.assignedGrade === "Grade 4-7") return /^Grade [4-7]$/.test(learner.grade || "");
    return learner.grade === user.assignedGrade;
  }
  if (user.role === "Teacher") return learner.grade === user.assignedGrade && learner.class === user.assignedClass;
  return !!user.learnerId && learner.id === user.learnerId;
}
function recordInUserScope(record, user) {
  if (["Admin", "Principal"].includes(user.role)) return true;
  if (record.learnerId) return learnerInUserScope((state.schoolData?.learners || []).find(x => x.id === record.learnerId) || { id: record.learnerId }, user);
  return false;
}
app.get("/api/admin/data", requireAuth, async (req, res, next) => {
  try {
    if (!state.schoolData) return res.json({ initialized: false, learners: [], assessments: [], learnerAttendance: [], learnerReports: [], docs: [] });
    const clean = cleanLegacyDemoSchoolData(state.schoolData);
    if (JSON.stringify(clean) !== JSON.stringify(state.schoolData)) {
      state.schoolData = clean;
      await saveState();
    }
    const user = req.schoolUser;
    if (["Admin", "Principal"].includes(user.role)) return res.json({ ...clean, initialized: true });
    const visibleLearners = clean.learners.filter(row => learnerInUserScope(row, user));
    const visibleIds = new Set(visibleLearners.map(row => row.id));
    res.set("Cache-Control", "no-store");
    res.json({
      learners: visibleLearners,
      assessments: clean.assessments.filter(row => visibleIds.has(row.learnerId)),
      learnerAttendance: clean.learnerAttendance.filter(row => visibleIds.has(row.learnerId)),
      learnerReports: clean.learnerReports.filter(row => visibleIds.has(row.learnerId)),
      docs: [], initialized: true
    });
  } catch (err) { next(err); }
});
app.put("/api/admin/data", requireAuth, async (req, res, next) => {
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const clean = {};
    for (const key of ["learners", "assessments", "learnerAttendance", "learnerReports", "docs"]) {
      if (!Array.isArray(input[key])) return sendError(res, 400, "School data must include valid record lists.");
      clean[key] = input[key];
    }
    if (JSON.stringify(clean).length > 6 * 1024 * 1024) return sendError(res, 413, "School records exceed the F1 data limit.");
    const user = req.schoolUser;
    if (["Admin", "Principal"].includes(user.role)) state.schoolData = clean;
    else {
      if (!["Vice Principal", "Teacher"].includes(user.role)) return sendError(res, 403, "This account has read-only school record access.");
      const current = state.schoolData || { learners: [], assessments: [], learnerAttendance: [], learnerReports: [], docs: [] };
      const learnerIds = new Set((current.learners || []).filter(row => learnerInUserScope(row, user)).map(row => row.id));
      if (clean.learners.some(row => !learnerInUserScope(row, user)) || ["assessments", "learnerAttendance", "learnerReports"].some(key => clean[key].some(row => !learnerIds.has(row.learnerId)))) return sendError(res, 403, "Changes include records outside this account's assigned scope.");
      for (const key of ["learners", "assessments", "learnerAttendance", "learnerReports"]) {
        const inScope = row => key === "learners" ? learnerInUserScope(row, user) : recordInUserScope(row, user);
        state.schoolData[key] = [...(current[key] || []).filter(row => !inScope(row)), ...clean[key]];
      }
      state.schoolData.docs = current.docs || [];
    }
    await saveState();
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});
app.get("/api/admin/admissions", requireSchoolManager, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ items: (state.admissions || []).map(({ reference, learner, status, receivedAt, submittedAt }) => ({ reference, learner, status, receivedAt, submittedAt })) });
});
app.get("/api/admin/admissions/:reference", requireSchoolManager, (req, res) => {
  const record = (state.admissions || []).find(x => x.reference === req.params.reference);
  if (!record) return sendError(res, 404, "Application not found.");
  res.set("Cache-Control", "no-store");
  res.json(record);
});
app.patch("/api/admin/admissions/:reference", requireSchoolManager, async (req, res, next) => {
  try {
    const record = (state.admissions || []).find(x => x.reference === req.params.reference);
    if (!record) return sendError(res, 404, "Application not found.");
    const { learner, application, adminNotes } = req.body || {};
    if (!learner || typeof learner !== "object" || Array.isArray(learner) || !application || typeof application !== "object" || Array.isArray(application)) return sendError(res, 400, "Learner and application fields must be valid objects.");
    if (JSON.stringify({ learner, application }).length > 2 * 1024 * 1024) return sendError(res, 413, "Edited application fields are too large.");
    if (typeof adminNotes !== "string" || adminNotes.length > 4000) return sendError(res, 400, "Admin notes are invalid.");
    record.learner = learner;
    record.application = application;
    record.adminNotes = adminNotes;
    record.updatedAt = new Date().toISOString();
    await saveState();
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, updatedAt: record.updatedAt });
  } catch (err) { next(err); }
});
app.get("/api/admin/admissions/:reference/download", requireSchoolManager, (req, res) => {
  const record = (state.admissions || []).find(x => x.reference === req.params.reference);
  if (!record) return sendError(res, 404, "Application not found.");
  res.set("Cache-Control", "no-store");
  res.set("Content-Disposition", `attachment; filename="${record.reference}.json"`);
  res.type("application/json").send(JSON.stringify(record, null, 2));
});
app.delete("/api/admin/admissions/:reference", requireSchoolManager, async (req, res, next) => {
  try {
    const before = state.admissions || [];
    state.admissions = before.filter(row => row.reference !== req.params.reference);
    if (before.length === state.admissions.length) return sendError(res, 404, "Application not found in the inbox.");
    await saveState();
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post("/api/admin/admissions/:reference/decision", requireSchoolManager, async (req, res, next) => {
  try {
    const index = (state.admissions || []).findIndex(row => row.reference === req.params.reference);
    if (index < 0) return sendError(res, 404, "Application not found in the inbox.");
    const record = state.admissions[index];
    const action = String(req.body?.action || "");
    if (action === "reject") {
      const message = String(req.body?.parentMessage || "").trim();
      if (!message || message.length > 2000) return sendError(res, 400, "Enter a parent-facing correction message (up to 2,000 characters).");
      record.status = "Rejected";
      record.parentMessage = message;
      record.rejectedAt = new Date().toISOString();
    } else if (action === "approve") {
      record.status = "Approved";
      record.approvedAt = new Date().toISOString();
      record.applicationNumber = record.applicationNumber || "NMP-APP-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      state.approvedApplications = Array.isArray(state.approvedApplications) ? state.approvedApplications : [];
      state.approvedApplications.unshift(record);
      state.admissions.splice(index, 1);
    } else return sendError(res, 400, "Choose approve or reject.");
    await saveState();
    res.json({ ok: true, status: record.status, applicationNumber: record.applicationNumber || null });
  } catch (err) { next(err); }
});
app.get("/api/admin/approved-applications", requireSchoolManager, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ items: (state.approvedApplications || []).map(({ reference, applicationNumber, learner, receivedAt, approvedAt }) => ({ reference, applicationNumber, learner, receivedAt, approvedAt })) });
});
app.get("/api/admin/approved-applications/:reference", requireSchoolManager, (req, res) => {
  const record = (state.approvedApplications || []).find(row => row.reference === req.params.reference);
  if (!record) return sendError(res, 404, "Approved application not found.");
  res.set("Cache-Control", "no-store");
  res.json(record);
});
app.get("/api/admin/approved-applications/:reference/download", requireSchoolManager, (req, res) => {
  const record = (state.approvedApplications || []).find(row => row.reference === req.params.reference);
  if (!record) return sendError(res, 404, "Approved application not found.");
  res.set("Cache-Control", "no-store");
  res.set("Content-Disposition", `attachment; filename="${record.reference}.json"`);
  res.type("application/json").send(JSON.stringify(record, null, 2));
});
function parentApplicationView(record) {
  const { ownerId, adminNotes, ...safe } = record;
  return safe;
}
app.get("/api/public/parent/applications", requireParent, (req, res) => {
  const ownerId = req.schoolUser.id;
  const items = [...(state.admissions || []), ...(state.approvedApplications || [])]
    .filter(row => row.ownerId === ownerId)
    .map(({ reference, applicationNumber, learner, status, submittedAt, receivedAt, updatedAt, approvedAt, parentMessage }) => ({ reference, applicationNumber, learner, status, submittedAt, receivedAt, updatedAt, approvedAt, parentMessage }));
  res.set("Cache-Control", "no-store");
  res.json({ items });
});
app.get("/api/public/parent/applications/:reference", requireParent, (req, res) => {
  const ownerId = req.schoolUser.id;
  const record = [...(state.admissions || []), ...(state.approvedApplications || [])].find(row => row.reference === req.params.reference && row.ownerId === ownerId);
  if (!record) return sendError(res, 404, "Application not found for this parent account.");
  res.set("Cache-Control", "no-store");
  res.json(parentApplicationView(record));
});
app.patch("/api/public/parent/applications/:reference", requireParent, async (req, res, next) => {
  try {
    const record = (state.admissions || []).find(row => row.reference === req.params.reference && row.ownerId === req.schoolUser.id);
    if (!record) return sendError(res, 404, "Application not found for this parent account.");
    if (record.status !== "Rejected") return sendError(res, 409, "Only rejected applications can be corrected and resubmitted.");
    const { learner, application, documents } = req.body || {};
    if (!learner || typeof learner !== "object" || Array.isArray(learner) || !learner.fullName || !application || typeof application !== "object" || Array.isArray(application)) return sendError(res, 400, "The corrected application is incomplete.");
    if (documents && (typeof documents !== "object" || Array.isArray(documents))) return sendError(res, 400, "Submitted documents are invalid.");
    if (JSON.stringify({ learner, application, documents }).length > 8 * 1024 * 1024) return sendError(res, 413, "Corrected application is too large.");
    record.learner = learner;
    record.application = application;
    if (documents && Object.values(documents).some(items => Array.isArray(items) && items.length)) {
      for (const [key, items] of Object.entries(documents)) if (Array.isArray(items) && items.length) record.documents[key] = [...(record.documents[key] || []), ...items];
    }
    record.status = "Received by school";
    record.parentMessage = "";
    record.updatedAt = new Date().toISOString();
    record.resubmittedAt = record.updatedAt;
    await saveState();
    res.set("Cache-Control", "no-store");
    res.json(parentApplicationView(record));
  } catch (err) { next(err); }
});
app.post("/api/public/admissions", requireParent, async (req, res, next) => {
  try {
    const record = req.body;
    if (!record || !/^NMP-\d{4}-\d{5}$/.test(String(record.reference || "")) || !record.learner?.fullName || !record.application || typeof record.application !== "object") return sendError(res, 400, "The application is incomplete.");
    const serialized = JSON.stringify(record);
    if (serialized.length > 8 * 1024 * 1024) return sendError(res, 413, "Application is too large. Save fewer/smaller documents and retry.");
    const admissions = Array.isArray(state.admissions) ? state.admissions : [];
    if (Buffer.byteLength(JSON.stringify(admissions)) + Buffer.byteLength(serialized) > 80 * 1024 * 1024) return sendError(res, 413, "The school application storage quota is full.");
    if ([...admissions, ...(state.approvedApplications || [])].some(x => x.reference === record.reference)) return sendError(res, 409, "This application reference was already submitted.");
    const saved = { ...record, ownerId: req.schoolUser.id, status: "Received by school", parentMessage: "", receivedAt: new Date().toISOString() };
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
app.get("/api/admin/media", requireSchoolManager, async (_req, res, next) => {
  try {
    const used = await directoryBytes(mediaRoot);
    res.json({ items: state.items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(safePublicItem), usedBytes: used, limitBytes: totalMediaLimitBytes });
  } catch (err) { next(err); }
});
app.post("/api/admin/media", requireSchoolManager, upload.single("file"), async (req, res, next) => {
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
    const mimeType = req.file ? uploadedMimeType(req.file) : "";
    if (req.file && !mimeType) return sendError(res, 415, "Unsupported file. Use a common image, video, audio, PDF, Office, OpenDocument, RTF, CSV, or text file.");
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
      const ext = path.extname(String(req.file.originalname || "")).toLowerCase();
      const safeExt = extensionMimeTypes[ext] === mimeType ? ext : Object.keys(extensionMimeTypes).find(candidate => extensionMimeTypes[candidate] === mimeType) || ".bin";
      filename = id + safeExt;
      await fs.writeFile(path.join(mediaRoot, filename), req.file.buffer, { flag: "wx", mode: 0o600 });
    }
    const originalName = req.file ? path.basename(String(req.file.originalname || "uploaded-file")).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) : "";
    const item = { id, type, title, description, grade, subject, teacher, lessonDate, filename, originalName, mimeType, size: req.file?.size || 0, createdAt: new Date().toISOString(), published };
    if (mimeType.startsWith("video/")) {
      try { await ensureVideoPreview(item); }
      catch (err) {
        await Promise.all([
          fs.rm(path.join(mediaRoot, filename), { force: true }),
          fs.rm(path.join(mediaRoot, id + "-preview.mp4"), { force: true }),
          fs.rm(path.join(mediaRoot, id + "-poster.jpg"), { force: true })
        ]);
        return sendError(res, 415, "This video could not be converted for in-app preview. Try exporting it as MP4 or WebM.");
      }
    }
    state.items.unshift(item);
    await saveState();
    res.status(201).json(safePublicItem(item));
  } catch (err) { next(err); }
});
app.delete("/api/admin/media/:id", requireSchoolManager, async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id);
    if (!item) return sendError(res, 404, "Post not found.");
    state.items = state.items.filter(x => x.id !== item.id);
    await saveState();
    for (const filename of [item.filename, item.previewVideoFilename, item.previewPosterFilename]) {
      if (filename) await fs.rm(path.join(mediaRoot, filename), { force: true });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.get("/api/media/:id/preview", async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id && x.published && x.filename && String(x.mimeType || "").startsWith("image/"));
    if (!item) return res.sendStatus(404);
    const source = path.join(mediaRoot, item.filename);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (item.mimeType === "image/gif") {
      res.type("image/gif");
      return res.sendFile(source);
    }
    const preview = await sharp(source, { limitInputPixels: 40000000, failOn: "warning" })
      .rotate()
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    res.type("image/webp").send(preview);
  } catch (err) { next(err); }
});
app.get("/api/media/:id/preview-video", async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id && x.published && x.filename && String(x.mimeType || "").startsWith("video/"));
    if (!item) return res.sendStatus(404);
    const wasGenerated = !!item.previewVideoFilename;
    try { await ensureVideoPreview(item); }
    catch (err) { return sendError(res, 415, "Video preview conversion failed. Re-export as MP4 or WebM and upload again."); }
    if (!wasGenerated) await saveState();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("video/mp4").sendFile(path.join(mediaRoot, item.previewVideoFilename));
  } catch (err) { next(err); }
});
app.get("/api/media/:id/poster", async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id && x.published && x.filename && String(x.mimeType || "").startsWith("video/"));
    if (!item) return res.sendStatus(404);
    const wasGenerated = !!item.previewVideoFilename;
    try { await ensureVideoPreview(item); }
    catch (err) { return sendError(res, 415, "Video preview is unavailable for this file."); }
    if (!wasGenerated) await saveState();
    if (!item.previewPosterFilename) return res.sendStatus(404);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("image/jpeg").sendFile(path.join(mediaRoot, item.previewPosterFilename));
  } catch (err) { next(err); }
});
app.get("/api/media/:id", async (req, res, next) => {
  try {
    const item = state.items.find(x => x.id === req.params.id && x.published && x.filename);
    if (!item) return res.sendStatus(404);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=300");
    if (item.mimeType === "application/pdf") res.setHeader("Content-Disposition", "inline; filename=\"" + path.basename(item.filename) + "\"");
    else if (item.mimeType === "image/svg+xml" || (!item.mimeType.startsWith("image/") && !item.mimeType.startsWith("video/") && !item.mimeType.startsWith("audio/"))) {
      res.attachment(item.originalName || path.basename(item.filename));
    }
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
  if (!Array.isArray(state.approvedApplications)) state.approvedApplications = [];
  if (!Array.isArray(state.users)) state.users = [];
  if (!state.schoolData || typeof state.schoolData !== "object") state.schoolData = null;
  app.listen(port, "0.0.0.0", () => console.log("N'wa Mhinga portal listening on port " + port));
}
start().catch(err => { console.error("Startup failed:", err.message); process.exit(1); });


