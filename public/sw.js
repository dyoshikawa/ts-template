// Service worker for ts-template.
//
// Hashed build assets under /assets/ are cached on first use and served from
// the cache afterwards (they never change under the same URL). Page loads
// always go to the network so data is fresh, with the offline page as a
// fallback. Server-function and auth calls are never cached.
//
// Push notifications arrive here as `push` events carrying the JSON the server
// sent (src/lib/push.ts: `{ title, body, url }`); tapping one focuses an open
// window of the app, or opens one, at that URL.
//
// Bump VERSION after changing the caching rules, or installed apps keep the old ones.

const VERSION = "v1";
const ASSET_CACHE = `ts-template-assets-${VERSION}`;
const SHELL_CACHE = `ts-template-shell-${VERSION}`;
// Static Assets serve public/offline.html at the extension-less URL and redirect
// the .html one; a redirected response cannot be served to a navigation.
const OFFLINE_URL = "/offline";
const SHELL_URLS = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];
const ICON_URL = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== ASSET_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((page) => page ?? Response.error()),
      ),
    );
    return;
  }

  const isImmutableAsset = url.pathname.startsWith("/assets/");
  const isShell = SHELL_URLS.includes(url.pathname) || url.pathname.startsWith("/icons/");
  if (!isImmutableAsset && !isShell) {
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(isImmutableAsset ? ASSET_CACHE : SHELL_CACHE)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

/** The notification a push carries; a push without a readable payload still shows one. */
function readPush(data) {
  try {
    const payload = data?.json() ?? {};
    return {
      title: typeof payload.title === "string" ? payload.title : "ts-template",
      body: typeof payload.body === "string" ? payload.body : "",
      url: typeof payload.url === "string" ? payload.url : "/",
    };
  } catch {
    return { title: "ts-template", body: data?.text() ?? "", url: "/" };
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = readPush(event.data);
  // Every push must show a notification (`userVisibleOnly`), or the browser
  // shows a generic one and may revoke the subscription.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON_URL,
      badge: ICON_URL,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only a path on this origin is followed; anything else opens the top page.
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        return open.focus().then((client) => client.navigate(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
