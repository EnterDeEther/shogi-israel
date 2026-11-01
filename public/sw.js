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
