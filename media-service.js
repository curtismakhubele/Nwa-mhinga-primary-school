"use strict";
let mediaApiMode = false;
let mediaRemotePosts = [];
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
  if (["Photo", "News", "Announcement"].includes(p.type) && url) media = '<img loading="lazy" src="' + url + '" alt="' + esc(p.title) + '">';
  else if (p.type === "Video" && url) media = '<video controls preload="none" src="' + url + '"></video>';
  else if (p.type === "Lesson" && url) media = p.mimeType === "application/pdf"
    ? '<a class="btn btn-blue" target="_blank" rel="noopener noreferrer" href="' + url + '">Open lesson PDF</a>'
    : '<video controls preload="none" src="' + url + '"></video>';
  return '<article class="media-card">' + media + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.description || "") + '</p><small class="muted">' + esc(p.createdAt || "") + '</small>' +
    (admin ? '<button class="btn btn-danger" onclick="removeMedia(\'' + esc(p.id) + '\')">Remove</button>' : '') + '</article>';
}
window.mediaCard = remoteMediaCard;
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
    host.innerHTML = '<p class="muted">Storage used: ' + (data.usedBytes / 1048576).toFixed(1) + ' MB / ' + (data.limitBytes / 1048576).toFixed(0) + ' MB</p><div class="media-grid">' +
      (mediaRemotePosts.map(p => remoteMediaCard(p, true)).join("") || '<div class="card empty">No school posts yet.</div>') + '</div>';
  } catch (err) { host.innerHTML = '<p class="err" style="display:block">' + esc(err.message) + '</p>'; }
}
window.mediaAdmin = function() {
  if (!mediaApiMode) return localMediaAdmin();
  setTimeout(refreshAdminMedia, 0);
  return '<div class="page-title"><div><h1>Media, Lessons & News</h1><div class="muted">Published posts appear on the login page.</div></div></div>' +
    '<div class="card"><div class="form-grid"><div class="field"><label for="mediaTitle">Title</label><input id="mediaTitle" class="input" maxlength="120"></div>' +
    '<div class="field"><label for="mediaType">Post type</label><select id="mediaType"><option>Photo</option><option>Video</option><option>Lesson</option><option>Announcement</option><option>News</option></select></div>' +
    '<div class="field wide"><label for="mediaDescription">Description / announcement</label><textarea id="mediaDescription" class="input" maxlength="1000"></textarea></div>' +
    '<div class="field wide"><label for="mediaFile">Upload photo, video or lesson (max 50 MB)</label><input id="mediaFile" class="input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"></div></div>' +
    '<p class="muted">F1 prototype storage is limited. Do not upload private learner information or photos without school consent.</p><button class="btn btn-primary" onclick="publishMedia()">Publish to login page</button></div>' +
    '<div id="media-admin-list" style="margin-top:16px"><div class="card empty">Loading school posts…</div></div>';
};
window.publishMedia = async function() {
  if (!mediaApiMode) return toast("Shared uploads need the F1 app server; this browser-only page cannot publish for everyone.");
  const title = document.getElementById("mediaTitle")?.value.trim();
  const type = document.getElementById("mediaType")?.value;
  const description = document.getElementById("mediaDescription")?.value.trim() || "";
  const file = document.getElementById("mediaFile")?.files?.[0] || null;
  if (!title) return toast("Enter a title.");
  if (["Photo", "Video", "Lesson"].includes(type) && !file) return toast("Choose a file to upload.");
  const form = new FormData();
  form.append("title", title); form.append("type", type); form.append("description", description);
  if (file) form.append("file", file);
  try {
    const r = await fetch("/api/admin/media", { method: "POST", credentials: "same-origin", body: form });
    const data = await r.json();
    if (r.status === 401) { window.apiUser = null; window.login(); return toast("Please sign in as the school administrator."); }
    if (!r.ok) throw new Error(data.error || "Upload failed.");
    document.getElementById("mediaTitle").value = "";
    document.getElementById("mediaDescription").value = "";
    const picker = document.getElementById("mediaFile"); if (picker) picker.value = "";
    await refreshPublicMedia(); await refreshAdminMedia(); toast("Post published on the login page.");
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
