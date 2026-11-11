"use strict";
let mediaApiMode = false;
let mediaRemotePosts = [];
let mediaAdminView = "All";
let mediaUsedBytes = 0;
let mediaLimitBytes = 0;
let localPortalLogin = window.doLogin;
let localPortalLogout = window.logout;
let localPortalMe = window.me;
let localPortalCan = window.can;
let localMediaAdmin = window.mediaAdmin;

function portalUrl(value) {
  try {
    const u = new URL(value, location.href);
    return ["http:", "https:"].includes(u.protocol) ? esc(u.href) : "";
  } catch { return ""; }
}
function remoteMediaCard(p, admin) {
  const url = portalUrl(p.fileUrl || p.url || "");
  let media = "";
  if (["Photo", "Image", "News", "Announcement"].includes(p.type) && url && String(p.mimeType || "").startsWith("image/")) media = '<img loading="lazy" src="' + url + '" alt="' + esc(p.title) + '">';
  else if (p.type === "Video" && url) media = '<video controls preload="none" src="' + url + '"></video>';
  else if (p.type === "Audio" && url) media = '<audio controls preload="none" src="' + url + '"></audio>';
  else if (["Document", "Lesson"].includes(p.type) && url) media = p.mimeType === "application/pdf"
    ? '<a class="btn btn-blue" target="_blank" rel="noopener noreferrer" href="' + url + '">Open ' + (p.type === "Lesson" ? "lesson" : "document") + ' PDF</a>'
    : String(p.mimeType || "").startsWith("audio/") ? '<audio controls preload="none" src="' + url + '"></audio>' : '<video controls preload="none" src="' + url + '"></video>';
  const lessonInfo = p.type === "Lesson" ? '<small class="muted lesson-meta">' + [p.grade, p.subject, p.teacher, p.lessonDate].filter(Boolean).map(esc).join(" · ") + '</small>' : "";
  return '<article class="media-card">' + media + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.description || "") + '</p>' + lessonInfo + '<small class="muted">' + esc(p.createdAt || "") + '</small>' +
    (admin ? '<button class="btn btn-danger" onclick="removeMedia(\'' + esc(p.id) + '\')">Remove</button>' : '') + '</article>';
}
window.mediaCard = remoteMediaCard;
window.dashboardPostCount = function() { return mediaApiMode ? mediaRemotePosts.filter(p => p.published !== false).length : (db.mediaPosts || []).filter(p => p.published !== false).length; };
window.dashboardPosts = function() {
  const posts = (mediaApiMode ? mediaRemotePosts : (db.mediaPosts || [])).filter(p => p.published !== false).slice(0, 3);
  return posts.length ? posts.map(p => remoteMediaCard(p, false)).join("") : "<p class='empty'>School news and lessons will appear here.</p>";
};
window.loginMedia = function() {
  const posts = mediaApiMode ? mediaRemotePosts : (db.mediaPosts || []);
  return '<h2>News, announcements & lessons</h2><p class="muted">Updates shared by the school.</p>' +
    (posts.length ? posts.slice(0, 6).map(p => remoteMediaCard(p, false)).join("") : '<p class="empty">School news and lessons will appear here.</p>');
};
async function refreshPublicMedia() {
  const r = await fetch("/api/public/media", { cache: "no-store", credentials: "same-origin" });
  if (!r.ok) return;
  const data = await r.json();
  mediaRemotePosts = Array.isArray(data.items) ? data.items : [];
  const feed = document.querySelector(".public-feed");
  if (feed) feed.innerHTML = window.loginMedia();
  const dashboardFeed = document.getElementById("dashboardNews");
  if (dashboardFeed) dashboardFeed.innerHTML = window.dashboardPosts();
  const resourceCount = document.querySelector(".dash-stat:nth-child(4) strong");
  if (resourceCount) resourceCount.textContent = window.dashboardPostCount();
}
async function refreshAdminMedia() {
  const host = document.getElementById("media-admin-list");
  if (!host || !mediaApiMode) return;
  try {
    const r = await fetch("/api/admin/media", { credentials: "same-origin", cache: "no-store" });
    if (r.status === 401) { window.apiUser = null; window.login(); return; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not load media.");
    mediaRemotePosts = Array.isArray(data.items) ? data.items : [];
    mediaUsedBytes = Number(data.usedBytes || 0);
    mediaLimitBytes = Number(data.limitBytes || 0);
    drawAdminMedia();
  } catch (err) { host.innerHTML = '<p class="err" style="display:block">' + esc(err.message) + '</p>'; }
}
function drawAdminMedia() {
  const host = document.getElementById("media-admin-list"); if (!host) return;
  const kinds = ["All", "Lesson", "Photo", "Video", "Audio", "Document", "Announcement", "News"];
  const posts = mediaRemotePosts.filter(p => mediaAdminView === "All" || p.type === mediaAdminView);
  const lessons = posts.filter(p => p.type === "Lesson");
  const body = mediaAdminView === "Lesson"
    ? '<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Grade</th><th>Subject</th><th>Teacher</th><th>Date</th><th></th></tr></thead><tbody>' +
      (lessons.map(p => '<tr><td><b>' + esc(p.title) + '</b><div class="muted">' + esc(p.description || "") + '</div></td><td>' + esc(p.grade || "—") + '</td><td>' + esc(p.subject || "—") + '</td><td>' + esc(p.teacher || "—") + '</td><td>' + esc(p.lessonDate || "—") + '</td><td><button class="btn btn-danger" onclick="removeMedia(\'' + esc(p.id) + '\')">Delete</button></td></tr>').join("") || '<tr><td colspan="6" class="empty">No lessons published yet.</td></tr>') + '</tbody></table></div>'
    : '<div class="media-grid">' + (posts.map(p => remoteMediaCard(p, true)).join("") || '<div class="card empty">No ' + (mediaAdminView === "All" ? "school posts" : esc(mediaAdminView.toLowerCase() + " posts")) + ' yet.</div>') + '</div>';
  host.innerHTML = '<div class="media-storage-line">Storage used: ' + (mediaUsedBytes / 1048576).toFixed(1) + ' MB / ' + (mediaLimitBytes / 1048576).toFixed(0) + ' MB</div><div class="filter-bar media-filters">' +
    kinds.map(k => '<button class="filter-btn ' + (mediaAdminView === k ? 'active' : '') + '" onclick="setMediaAdminView(\'' + k + '\')">' + k + (k === "Lesson" ? ' · ' + mediaRemotePosts.filter(p => p.type === "Lesson").length : '') + '</button>').join("") + '</div>' + body;
}
window.setMediaAdminView = function(view) { mediaAdminView = view; drawAdminMedia(); };
window.mediaAdmin = function() {
  if (!mediaApiMode) return localMediaAdmin();
  setTimeout(refreshAdminMedia, 0);
  mediaAdminView = "All";
  return '<div class="page-title"><div><h1>School Media & Lessons</h1><div class="muted">Publish lessons, photos, videos, audio, documents, news and announcements.</div></div></div>' +
    '<div class="card"><div class="form-grid"><div class="field"><label for="mediaTitle">Title</label><input id="mediaTitle" class="input" maxlength="120" required></div>' +
    '<div class="field"><label for="mediaType">Post type</label><select id="mediaType" onchange="mediaTypeChanged()"><option>Lesson</option><option>Photo</option><option>Video</option><option>Audio</option><option>Document</option><option>Announcement</option><option>News</option></select></div>' +
    '<div class="field"><label for="mediaGrade">Grade</label><select id="mediaGrade">' + ["Grade R","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"].map(g=>'<option>'+g+'</option>').join("") + '</select></div>' +
    '<div class="field"><label for="mediaSubject">Subject</label><select id="mediaSubject">' + ["English","Mathematics","Life Skills","Natural Sciences","Social Sciences","Technology","itsonga","Other"].map(s=>'<option>'+s+'</option>').join("") + '</select></div>' +
    '<div class="field"><label for="mediaTeacher">Teacher</label><input id="mediaTeacher" class="input" maxlength="100" placeholder="Teacher name"></div>' +
    '<div class="field"><label for="mediaLessonDate">Lesson date</label><input id="mediaLessonDate" class="input" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div>' +
    '<div class="field wide"><label for="mediaDescription">Description / announcement</label><textarea id="mediaDescription" class="input" maxlength="1000"></textarea></div>' +
    '<div class="field wide"><label for="mediaFile">Upload a file (max 50 MB)</label><input id="mediaFile" class="input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,application/pdf"></div></div>' +
    '<p class="muted">Files and posts are shared on the public login page. F1 storage is limited to the configured app quota.</p><button class="btn btn-primary" onclick="publishMedia()">Publish</button></div>' +
    '<div id="media-admin-list" style="margin-top:16px"><div class="card empty">Loading school posts…</div></div>';
};
window.mediaTypeChanged = function() {
  const isLesson = document.getElementById("mediaType")?.value === "Lesson";
  ["mediaGrade", "mediaSubject", "mediaTeacher", "mediaLessonDate"].forEach(id => {
    const field = document.getElementById(id); if (field) field.closest(".field").hidden = !isLesson;
  });
};
window.publishMedia = async function() {
  if (!mediaApiMode) return toast("Shared uploads need the F1 app server; this browser-only page cannot publish for everyone.");
  const title = document.getElementById("mediaTitle")?.value.trim();
  const type = document.getElementById("mediaType")?.value;
  const description = document.getElementById("mediaDescription")?.value.trim() || "";
  const file = document.getElementById("mediaFile")?.files?.[0] || null;
  if (!title) return toast("Enter a title.");
  if (["Photo", "Video", "Audio", "Document", "Lesson"].includes(type) && !file) return toast("Choose a file to upload.");
  if (type === "Lesson" && (!document.getElementById("mediaGrade")?.value || !document.getElementById("mediaSubject")?.value || !document.getElementById("mediaLessonDate")?.value)) return toast("Choose the lesson grade, subject and date.");
  const form = new FormData();
  form.append("title", title); form.append("type", type); form.append("description", description);
  if (type === "Lesson") {
    form.append("grade", document.getElementById("mediaGrade").value);
    form.append("subject", document.getElementById("mediaSubject").value);
    form.append("teacher", document.getElementById("mediaTeacher").value.trim());
    form.append("lessonDate", document.getElementById("mediaLessonDate").value);
  }
  if (file) form.append("file", file);
  try {
    const r = await fetch("/api/admin/media", { method: "POST", credentials: "same-origin", body: form });
    const data = await r.json();
    if (r.status === 401) { window.apiUser = null; window.login(); return toast("Please sign in as the school administrator."); }
    if (!r.ok) throw new Error(data.error || "Upload failed.");
    document.getElementById("mediaTitle").value = "";
    document.getElementById("mediaDescription").value = "";
    const picker = document.getElementById("mediaFile"); if (picker) picker.value = "";
    await refreshPublicMedia(); await refreshAdminMedia(); toast("Published on the login page.");
  } catch (err) { toast(err.message); }
};
window.removeMedia = async function(id) {
  if (mediaApiMode) {
    try {
      const r = await fetch("/api/admin/media/" + encodeURIComponent(id), { method: "DELETE", credentials: "same-origin" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not remove post.");
      await refreshPublicMedia(); await refreshAdminMedia(); toast("Post removed.");
    } catch (err) { toast(err.message); }
    return;
  }
  db.mediaPosts = (db.mediaPosts || []).filter(p => p.id !== id); save(); render("media");
};
window.me = function() { return window.apiUser || localPortalMe(); };
window.can = function(page) {
  if (window.apiUser) return ["dashboard","users","learners","classes","assessments","reports","upload","backup","settings","attendance","media","admissions"].includes(page);
  return localPortalCan(page);
};
window.doLogin = async function() {
  if (!mediaApiMode) return localPortalLogin();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value || "";
  try {
    const r = await fetch("/api/admin/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await r.json();
    if (!r.ok) return alert(data.error || "Administrator sign-in failed.");
    window.apiUser = { id: "server-admin", name: "School Administrator", email: data.email, role: "Admin", assignedGrade: "All", assignedClass: "All", status: "Active" };
    await refreshPublicMedia(); render("dashboard"); toast("Signed in as school administrator.");
  } catch { alert("The school server is not reachable. Try again shortly."); }
};
window.logout = async function() {
  if (mediaApiMode && window.apiUser) {
    try { await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }); } catch {}
    window.apiUser = null;
    window.login();
    return;
  }
  return localPortalLogout();
};
async function initializeMediaApp() {
  try {
    const health = await fetch("/api/health", { cache: "no-store" });
    if (!health.ok) throw new Error("API unavailable");
    mediaApiMode = true;
    const session = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
    const status = await session.json();
    if (status.authenticated) {
      window.apiUser = { id: "server-admin", name: "School Administrator", email: status.email, role: "Admin", assignedGrade: "All", assignedClass: "All", status: "Active" };
      render("dashboard");
    } else {
      window.apiUser = null;
      window.login();
      document.getElementById("email")?.setAttribute("placeholder", "Administrator email");
      const email = document.getElementById("email"); if (email) email.value = "";
      const password = document.getElementById("password"); if (password) password.value = "";
      document.querySelector(".demo-box")?.remove();
      const helper = document.querySelector(".login-card .muted");
      if (helper) helper.textContent = "Sign in with the administrator account configured for this app.";
    }
    await refreshPublicMedia();
  } catch {
    mediaApiMode = false;
    window.apiUser = null;
    window.login();
  }
}
initializeMediaApp();

