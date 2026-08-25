/* Qai Web Push service worker. Keep this dependency-free so iOS can install it directly. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function safePushPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  try {
    const target = new URL(value, self.location.origin);
    return target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  } catch { return "/dashboard"; }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "You have a new Qai update." }; }
  const title = payload.title || "Qai";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "You have a new update.",
    icon: "/icons/qai-icon-192.png?v=20260816",
    badge: "/icons/qai-favicon-32.png?v=20260816",
    tag: payload.tag || "qai-update",
    data: { url: safePushPath(payload.url) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePushPath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
