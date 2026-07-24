/* portal widget — embeddable chatbot
 *
 * Usage:
 *   <script src="https://your-portal.example.com/widget.js"
 *           data-public-key="..."
 *           data-api-origin="https://api.example.com"  // optional; see below
 *           data-locale="he"        // optional, "he" or "en"; auto-detect otherwise
 *           data-title="Chat"       // optional header title
 *           data-side="end"></script>  // "start" or "end"; defaults "end" (right in LTR)
 *
 * API origin: data-api-origin if set, otherwise the script tag's src origin.
 * When the widget JS and the API live on different hosts (e.g. app.* serves
 * the script but api.* serves the backend), pass data-api-origin so calls
 * reach the backend. The embed snippet in business settings fills this in.
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
  var API_ORIGIN = script.dataset.apiOrigin || new URL(script.src).origin;
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
    // Brand faces first, system stack behind. The widget deliberately does not
    // pull a webfont onto the host site — when the host already serves Rubik or
    // Heebo (as portalstudio.co.il does) the widget matches the product; when it
    // doesn't, it falls back to the host's native UI face rather than a slow
    // third-party font request.
    ":host,*{box-sizing:border-box;font-family:'Rubik','Heebo',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}" +
    ".bubble{width:60px;height:60px;border-radius:50%;background:#6091B0;color:#fff;border:none;cursor:pointer;box-shadow:0 10px 26px rgba(1,20,39,0.22);display:grid;place-items:center;transition:transform .15s ease}" +
    ".bubble:hover{transform:scale(1.06)}" +
    ".bubble svg{width:26px;height:26px}" +
    ".panel{position:absolute;bottom:74px;width:360px;height:520px;max-height:80vh;background:#fff;border-radius:18px;box-shadow:0 24px 56px rgba(1,20,39,0.24);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(1,20,39,0.06)}" +
    ".panel[data-side='end']{right:0}" +
    ".panel[data-side='start']{left:0}" +
    ".header{background:#011427;color:#fff;padding:14px 16px;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:space-between}" +
    ".header .close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:4px;opacity:.85}" +
    ".header .close:hover{opacity:1}" +
    ".banner{padding:8px 12px;font-size:12px;background:#fbeee9;color:#b24430;text-align:center;border-bottom:1px solid rgba(1,20,39,0.05)}" +
    ".list{flex:1;overflow-y:auto;padding:12px;background:#FBF7F1;display:flex;flex-direction:column;gap:8px}" +
    ".msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}" +
    ".msg.customer{align-self:flex-end;background:#6091B0;color:#fff;border-bottom-right-radius:4px}" +
    ".msg.bot{align-self:flex-start;background:#fff;border:1px solid #ece4d9;color:#011427;border-bottom-left-radius:4px}" +
    ".msg.agent{align-self:flex-start;background:#357D78;color:#fff;border-bottom-left-radius:4px}" +
    "[dir='rtl'] .msg.customer{border-bottom-right-radius:14px;border-bottom-left-radius:4px}" +
    "[dir='rtl'] .msg.bot,[dir='rtl'] .msg.agent{border-bottom-left-radius:14px;border-bottom-right-radius:4px}" +
    ".time{font-size:10px;opacity:.7;margin-top:2px}" +
    ".composer{padding:10px;background:#fff;border-top:1px solid #ece4d9;display:flex;gap:8px;align-items:flex-end}" +
    ".composer textarea{flex:1;border:1px solid #d9d0c4;border-radius:12px;padding:8px 10px;font-size:14px;font-family:inherit;resize:none;outline:none;max-height:120px;min-height:38px;background:#fff}" +
    ".composer textarea:focus{border-color:#6091B0;box-shadow:0 0 0 2px rgba(96,145,176,0.20)}" +
    ".composer button{background:#6091B0;color:#fff;border:none;border-radius:12px;padding:0 14px;height:38px;cursor:pointer;font-weight:600;font-size:14px;transition:background .15s ease}" +
    ".composer button:hover:not(:disabled){background:#527e9c}" +
    ".composer button:disabled{opacity:.5;cursor:not-allowed}" +
    ".typing{padding:8px 12px;font-size:12px;color:#6c7a86}" +
    ".empty{padding:24px 16px;font-size:13px;color:#6c7a86;text-align:center}";
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.setAttribute("dir", DIR);
  root.appendChild(wrap);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", T.open);
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
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
