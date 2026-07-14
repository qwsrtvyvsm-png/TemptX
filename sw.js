const CACHE_NAME = "temptx-v28";
const APP_SHELL = [
  "/",
  "/index.html",
  "/directory.html",
  "/auth.html",
  "/chat.html",
  "/profile.html",
  "/creator-dashboard.html",
  "/settings.html",
  "/report.html",
  "/privacy.html",
  "/terms.html",
  "/verification.html",
  "/community-standards.html",
  "/provider-standards.html",
  "/moderation.html",
  "/style.css",
  "/creator-dashboard.css",
  "/script.js",
  "/directory.js",
  "/profile-public.js",
  "/creator-dashboard.js",
  "/auth.js",
  "/chat.js",
  "/settings.js",
  "/report.js",
  "/info-page.js",
  "/manifest.webmanifest",
  "/assets/temptx-chat-background.jpeg",
  "/assets/temptx-icon-192.png",
  "/assets/temptx-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/data/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
