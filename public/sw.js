const VERSION = 'v1';
const CACHE = `shogi-il-${VERSION}`;
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/app-icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/_astro/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) e.waitUntil(cache.put(req, res.clone()));
      return res;
    })());
    return;
  }
  if (req.mode !== 'navigate' || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = (await e.preloadResponse) || (await fetch(req));
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(url.pathname, copy)));
      }
      return res;
    } catch {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.pathname)) || (await cache.match(OFFLINE)) || Response.error();
    }
  })());
});

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch {}
  const title = m.title || 'שוגי ישראל';
  e.waitUntil(self.registration.showNotification(title, {
    body: m.body || '', tag: m.tag, icon: '/app-icon-192.png', badge: '/push-badge-96.png', lang: 'he', dir: 'rtl',
    data: { url: m.url || '/app/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/app/', location.origin);
  if (url.origin !== location.origin) return;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => 'focus' in w);
    if (win) { await win.focus(); return win.navigate(url.href).catch(() => self.clients.openWindow(url.href)); }
    return self.clients.openWindow(url.href);
  })());
});
