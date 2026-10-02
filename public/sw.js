const CACHE_NAME = "temptx-v35";
// Public pages are served at clean URLs (/directory); app pages keep .html.
// Listing a URL that redirects would cache the redirect and break offline
// navigation, so every entry here must answer 200 directly.
const APP_SHELL = [
  "/",
  "/directory",
  "/profile",
  "/privacy",
  "/terms",
  "/verification",
  "/community-standards",
  "/provider-standards",
  "/moderation",
  "/auth.html",
  "/chat.html",
  "/creator-dashboard.html",
  "/settings.html",
  "/report.html",
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
        .catch(async () => (await caches.match(request)) || caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          // Offline: pages ask for /style.css?v=<hash>, the shell holds /style.css.
          .catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error())
    )
  );
});
