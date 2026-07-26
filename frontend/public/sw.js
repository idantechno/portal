/*
 * Portal Studio — service worker.
 *
 * Strategy, chosen so a Railway redeploy can never strand a client on a stale
 * build:
 *   - Navigations (HTML): network-first, fall back to the cached app shell only
 *     when truly offline. New deploys are picked up on the next load.
 *   - Hashed build assets (/assets/*): cache-first — Vite content-hashes the
 *     filename, so a cached entry is immutable and safe to keep forever.
 *   - /api and /socket.io: never touched (auth'd, dynamic, real-time). The SW
 *     stays out of the request path entirely.
 *   - Anything cross-origin: passed straight through.
 *
 * Bump CACHE_VERSION to force every client to drop old caches on activate.
 */
const CACHE_VERSION = "v1";
const CACHE = `portal-${CACHE_VERSION}`;
const APP_SHELL = "/index.html";

// Pre-cache the shell + the install-time icons so the very first offline load
// still renders. Hashed JS/CSS are cached lazily as they are requested.
const PRECACHE = [APP_SHELL, "/", "/pwa-192.png", "/pwa-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Allow the page to trigger an immediate activation of a waiting SW.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only — let the browser handle cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never intercept the API or the websocket transport.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
    return;
  }

  // App navigations: network-first, cache the fresh shell, fall back offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(APP_SHELL, copy));
          return response;
        })
        .catch(() => caches.match(APP_SHELL).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Static assets: cache-first, then network (and populate the cache).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful, basic (same-origin) responses.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
