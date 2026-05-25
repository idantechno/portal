/* portal widget — embeddable chatbot
 *
 * Usage:
 *   <script src="https://your-portal.example.com/widget.js"
 *           data-public-key="..."
 *           data-locale="he"        // optional, "he" or "en"; auto-detect otherwise
 *           data-title="Chat"       // optional header title
 *           data-side="end"></script>  // "start" or "end"; defaults "end" (right in LTR)
 *
 * The script tag's src origin becomes the API origin, so the widget works
 * when embedded on a third-party site as long as that origin allows CORS
 * (TODO: backend hardening — see widget.controller.ts).
 */
(function () {
  "use strict";
  if (window.__portalWidgetLoaded) return;
  window.__portalWidgetLoaded = true;

  var script = document.currentScript;
  if (!script || !script.dataset.publicKey) {
    console.warn("[portal-widget] missing data-public-key");
    return;
  }

  var PUBLIC_KEY = script.dataset.publicKey;
  var API_ORIGIN = new URL(script.src).origin;
  var LOCALE = script.dataset.locale || detectLocale();
  var SIDE = script.dataset.side === "start" ? "start" : "end";
  var TITLE = script.dataset.title || (LOCALE === "he" ? "צ'אט" : "Chat");
  var STORAGE_KEY = "portal-widget-session-" + PUBLIC_KEY;
  var POLL_MS = 1800;

  var STRINGS = {
    he: {
      open: "פתח צ'אט",
      placeholder: "הקלד הודעה...",
      send: "שלח",
      starting: "מתחיל שיחה...",
      error: "שגיאה. נסה שוב.",
      agentJoined: "נציג אנושי הצטרף לשיחה",
      closed: "השיחה נסגרה",
    },
    en: {
      open: "Open chat",
      placeholder: "Type a message...",
      send: "Send",
      starting: "Starting chat...",
      error: "Error. Try again.",
      agentJoined: "A human agent has joined the chat",
      closed: "Conversation closed",
    },
  };
  var T = STRINGS[LOCALE] || STRINGS.en;
  var DIR = LOCALE === "he" ? "rtl" : "ltr";

  function detectLocale() {
    var nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("he") ? "he" : "en";
  }

  // ---- State ----------------------------------------------------------------
  var state = {
    sessionToken: null,
    conversationId: null,
    conversationStatus: "bot",
    open: false,
    pollTimer: null,
    starting: false,
    messages: [],
    lastSyncedAt: null,
    bannerShownForStatus: null,
  };

  // ---- DOM ------------------------------------------------------------------
  var host = document.createElement("div");
  host.setAttribute("data-portal-widget", "");
  host.style.cssText =
    "position:fixed;z-index:2147483646;bottom:20px;" +
    (SIDE === "start" ? "left:20px;right:auto;" : "right:20px;left:auto;") +
    "pointer-events:auto;";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    ":host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Heebo','Inter',sans-serif}" +
    ".bubble{width:60px;height:60px;border-radius:50%;background:#2563eb;color:#fff;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.18);display:grid;place-items:center;font-size:28px;transition:transform .15s ease}" +
    ".bubble:hover{transform:scale(1.06)}" +
    ".panel{position:absolute;bottom:74px;width:360px;height:520px;max-height:80vh;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.20);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(0,0,0,0.06)}" +
    ".panel[data-side='end']{right:0}" +
    ".panel[data-side='start']{left:0}" +
    ".header{background:#1d4ed8;color:#fff;padding:14px 16px;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:space-between}" +
    ".header .close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:4px}" +
    ".banner{padding:8px 12px;font-size:12px;background:#fef3c7;color:#92400e;text-align:center;border-bottom:1px solid rgba(0,0,0,0.05)}" +
    ".list{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}" +
    ".msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.35;white-space:pre-wrap;word-wrap:break-word}" +
    ".msg.customer{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px}" +
    ".msg.bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;color:#0f172a;border-bottom-left-radius:4px}" +
    ".msg.agent{align-self:flex-start;background:#10b981;color:#fff;border-bottom-left-radius:4px}" +
    "[dir='rtl'] .msg.customer{border-bottom-right-radius:12px;border-bottom-left-radius:4px}" +
    "[dir='rtl'] .msg.bot,[dir='rtl'] .msg.agent{border-bottom-left-radius:12px;border-bottom-right-radius:4px}" +
    ".time{font-size:10px;opacity:.7;margin-top:2px}" +
    ".composer{padding:10px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;align-items:flex-end}" +
    ".composer textarea{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;font-size:14px;font-family:inherit;resize:none;outline:none;max-height:120px;min-height:38px}" +
    ".composer textarea:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,0.15)}" +
    ".composer button{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:0 14px;height:38px;cursor:pointer;font-weight:600;font-size:14px}" +
    ".composer button:disabled{opacity:.5;cursor:not-allowed}" +
    ".typing{padding:8px 12px;font-size:12px;color:#64748b}" +
    ".empty{padding:24px 16px;font-size:13px;color:#64748b;text-align:center}";
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.setAttribute("dir", DIR);
  root.appendChild(wrap);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", T.open);
  bubble.textContent = "💬";
  bubble.addEventListener("click", togglePanel);
  wrap.appendChild(bubble);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("data-side", SIDE);
  panel.style.display = "none";
  wrap.appendChild(panel);

  var header = document.createElement("div");
  header.className = "header";
  var headerTitle = document.createElement("span");
  headerTitle.textContent = TITLE;
  var headerClose = document.createElement("button");
  headerClose.className = "close";
  headerClose.textContent = "✕";
  headerClose.addEventListener("click", togglePanel);
  header.appendChild(headerTitle);
  header.appendChild(headerClose);
  panel.appendChild(header);

  var banner = document.createElement("div");
  banner.className = "banner";
  banner.style.display = "none";
  panel.appendChild(banner);

  var list = document.createElement("div");
  list.className = "list";
  panel.appendChild(list);

  var composer = document.createElement("div");
  composer.className = "composer";
  var textarea = document.createElement("textarea");
  textarea.rows = 1;
  textarea.placeholder = T.placeholder;
  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });
  var sendBtn = document.createElement("button");
  sendBtn.textContent = T.send;
  sendBtn.addEventListener("click", sendCurrent);
  composer.appendChild(textarea);
  composer.appendChild(sendBtn);
  panel.appendChild(composer);

  // ---- API ------------------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    return fetch(API_ORIGIN + path, {
      method: opts.method || "GET",
      headers: opts.body
        ? { "Content-Type": "application/json" }
        : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function ensureSession() {
    var cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      cached = null;
    }
    if (cached && cached.sessionToken) {
      state.sessionToken = cached.sessionToken;
      state.conversationId = cached.conversationId;
      return Promise.resolve();
    }
    state.starting = true;
    renderStarting();
    return api("/api/widget/" + encodeURIComponent(PUBLIC_KEY) + "/session", {
      method: "POST",
    }).then(function (res) {
      state.sessionToken = res.sessionToken;
      state.conversationId = res.conversationId;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
      } catch (e) {
        /* ignore */
      }
      state.starting = false;
    });
  }

  function loadMessages() {
    if (!state.sessionToken) return Promise.resolve();
    return api(
      "/api/widget/session/" +
        encodeURIComponent(state.sessionToken) +
        "/messages",
    ).then(function (res) {
      state.messages = res.messages;
      var prevStatus = state.conversationStatus;
      state.conversationStatus = res.conversationStatus;
      if (
        prevStatus !== "human" &&
        state.conversationStatus === "human" &&
        state.bannerShownForStatus !== "human"
      ) {
        showBanner(T.agentJoined);
        state.bannerShownForStatus = "human";
      } else if (
        state.conversationStatus === "closed" &&
        state.bannerShownForStatus !== "closed"
      ) {
        showBanner(T.closed);
        state.bannerShownForStatus = "closed";
      }
      state.lastSyncedAt = new Date().toISOString();
      render();
    });
  }

  // ---- Rendering ------------------------------------------------------------
  function showBanner(text) {
    banner.textContent = text;
    banner.style.display = "block";
  }

  function renderStarting() {
    list.innerHTML = "";
    var p = document.createElement("div");
    p.className = "empty";
    p.textContent = T.starting;
    list.appendChild(p);
  }

  function render() {
    list.innerHTML = "";
    if (state.messages.length === 0) {
      var p = document.createElement("div");
      p.className = "empty";
      p.textContent = LOCALE === "he" ? "התחילו לכתוב..." : "Start a conversation...";
      list.appendChild(p);
      return;
    }
    state.messages.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "msg " + m.role;
      d.textContent = m.content;
      list.appendChild(d);
    });
    list.scrollTop = list.scrollHeight;
    sendBtn.disabled = state.conversationStatus === "closed";
    textarea.disabled = state.conversationStatus === "closed";
  }

  // ---- Actions --------------------------------------------------------------
  function togglePanel() {
    state.open = !state.open;
    panel.style.display = state.open ? "flex" : "none";
    if (state.open) {
      bubble.style.display = "none";
      open();
    } else {
      bubble.style.display = "grid";
      stopPolling();
    }
  }

  function open() {
    ensureSession()
      .then(loadMessages)
      .then(startPolling)
      .catch(function (err) {
        console.error("[portal-widget]", err);
        list.innerHTML = "";
        var p = document.createElement("div");
        p.className = "empty";
        p.textContent = T.error;
        list.appendChild(p);
      });
  }

  function sendCurrent() {
    var content = textarea.value.trim();
    if (!content || !state.sessionToken) return;
    textarea.value = "";
    // Optimistic append.
    state.messages.push({
      id: "local-" + Date.now(),
      role: "customer",
      content: content,
      createdAt: new Date().toISOString(),
    });
    render();
    api(
      "/api/widget/session/" +
        encodeURIComponent(state.sessionToken) +
        "/messages",
      { method: "POST", body: { content: content } },
    )
      .then(function () {
        // Refresh from server to pick up the canonical record.
        return loadMessages();
      })
      .catch(function (err) {
        console.error("[portal-widget]", err);
      });
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(loadMessages, POLL_MS);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }
})();
