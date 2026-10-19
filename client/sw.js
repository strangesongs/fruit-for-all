// Bump when the precache list or caching strategy changes. Since v3 every .js/.css
// file is content-hashed (see scripts/build-html.mjs), so cache-first is safe: a new
// deploy ships new file names, and index.html is fetched network-first.
const CACHE_VERSION = 'ffa-static-v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/loquat-48.png', '/loquat-192.png', '/loquat-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (error) {
            // Install should not fail if one optional asset misses.
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('static-') && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never cache API responses or map tiles; these should always stay network-fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/user/') || url.pathname.startsWith('/save/')) return;
  if (url.hostname.includes('stadiamaps.com') || url.hostname.includes('openstreetmap.org')) return;

  // App shell navigation fallback for same-origin routes.
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (error) {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match('/index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for same-origin static assets only.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok && /\.(?:js|css|png|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
          await cache.put(request, response.clone());
        }
        return response;
      })()
    );
  }
});
