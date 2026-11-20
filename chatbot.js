(() => {
  const faqs = [
    { keys: ["admission", "apply", "application", "enrol", "enroll", "register child"], answer: "To apply, open the Admissions page and create a parent account first. Sign in with that same ID/passport and password to submit, view, or amend an application." },
    { keys: ["track", "check application", "status", "amend", "edit application", "rejected"], answer: "Open Admissions and sign in with the ID/passport and password you used when applying. Your application status and school messages are in your parent workspace. Rejected applications can be corrected and resubmitted there." },
    { keys: ["grade", "grades", "grade r", "school level"], answer: "N’wa Mhinga Primary School serves Grade R through Grade 7." },
    { keys: ["address", "location", "directions", "map", "where"], answer: "The school is at Ntsu Street and Ramosa Street, Saulsville, Pretoria, 0125. You can open the location in Google Maps." , link: "https://www.google.com/maps/dir/?api=1&destination=-25.77897%2C28.05932", linkText: "Get directions" },
    { keys: ["phone", "call", "contact", "telephone"], answer: "The school contact number shown on the portal is 012 375 5514. Please call the school for help from a staff member." },
    { keys: ["media", "lesson", "video", "image", "document", "learning resource"], answer: "Open Media & Lessons on the school portal to view published learning resources. Sign in with your school account if prompted." },
    { keys: ["privacy", "personal information", "learner information", "my child", "records"], answer: "This chatbot cannot view or discuss private learner or guardian records. Sign in to the parent workspace for your own application, or contact the school for assistance." },
    { keys: ["password", "sign in", "login", "log in", "credential"], answer: "For an admission, use the ID/passport and password from your parent account. For a school staff account, sign in with the credentials issued by the school administrator." }
  ];
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "./chatbot.css?v=20261120";
  document.head.append(style);

  function mount() {
    if (document.getElementById("schoolChatbot")) return;
    const root = document.createElement("section");
    root.id = "schoolChatbot";
    root.className = "school-chatbot";
    root.setAttribute("aria-label", "N’wa Mhinga school help chatbot");
    root.innerHTML = `
      <section class="school-chat-panel" id="schoolChatPanel" hidden aria-label="School help chat">
        <header class="school-chat-head"><div><strong>N’wa Mhinga Help</strong><small>School information assistant</small></div><button class="school-chat-close" type="button" aria-label="Close chat">×</button></header>
        <div class="school-chat-messages" id="schoolChatMessages" role="log" aria-live="polite" aria-relevant="additions text">
          <p class="school-chat-message bot">Hello! I can help with admissions, application status, school location and learning resources. Please don’t send ID numbers or private learner information here.</p>
        </div>
        <div class="school-chat-chips" aria-label="Common questions"><button type="button">How do I apply?</button><button type="button">Where is the school?</button><button type="button">How do I check my application?</button></div>
        <form class="school-chat-form" id="schoolChatForm"><label class="school-chat-sr" for="schoolChatInput">Ask the school assistant</label><input id="schoolChatInput" maxlength="500" autocomplete="off" placeholder="Type a question…" required><button type="submit">Send</button></form>
      </section>
      <button class="school-chat-launch" type="button" aria-expanded="false" aria-controls="schoolChatPanel"><span aria-hidden="true">✦</span> Ask the school</button>`;
    document.body.append(root);
    const panel = root.querySelector("#schoolChatPanel");
    const launcher = root.querySelector(".school-chat-launch");
    const input = root.querySelector("#schoolChatInput");
    const messages = root.querySelector("#schoolChatMessages");
    function toggle(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      if (open) input.focus(); else launcher.focus();
    }
    function say(text, from = "bot", link = "", linkText = "") {
      const bubble = document.createElement("p");
      bubble.className = `school-chat-message ${from}`;
      bubble.textContent = text;
      messages.append(bubble);
      if (link) {
        const a = document.createElement("a");
        a.className = "school-chat-link";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = linkText;
        messages.append(a);
      }
      messages.scrollTop = messages.scrollHeight;
    }
    function respond(text) {
      const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      const found = faqs.find(item => item.keys.some(key => normalized.includes(key)));
      say(found ? found.answer : "I can help with admissions, checking an application, school location, contact details, grades, and learning resources. For anything else, please call the school on 012 375 5514.", "bot", found?.link || "", found?.linkText || "");
    }
    launcher.addEventListener("click", () => toggle(panel.hidden));
    root.querySelector(".school-chat-close").addEventListener("click", () => toggle(false));
    root.querySelector("#schoolChatForm").addEventListener("submit", event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      say(text, "user");
      input.value = "";
      window.setTimeout(() => respond(text), 180);
    });
    root.querySelectorAll(".school-chat-chips button").forEach(button => button.addEventListener("click", () => {
      const text = button.textContent;
      say(text, "user");
      window.setTimeout(() => respond(text), 180);
    }));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) toggle(false); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
