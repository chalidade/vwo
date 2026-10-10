// Lets the demo install as an app and open offline: pages come from the network when there is
// one (so a new deploy shows up), everything else from the cache first.
const CACHE = "vwo-v4";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Accounts and other server answers must always come fresh from the server.
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Notifications outside the app (Web Push): HR's replies, invitations, friend requests.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  const title = typeof d.title === "string" && d.title ? d.title : "Job Fair";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: typeof d.body === "string" ? d.body : "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: typeof d.tag === "string" ? d.tag : undefined,
      data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/play/" },
    }),
  );
});

// Tapping one opens the game (or brings an open tab of it to the front) where the news is.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/play/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const t of tabs) {
        if (new URL(t.url).origin === self.location.origin && "focus" in t) {
          t.navigate?.(url);
          return t.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
