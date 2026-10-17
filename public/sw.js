// Offline shell: serves the app's pages and assets from cache when the network
// is down. Server functions and database calls are never cached here — data
// offline support lives in the app's localStorage snapshot (src/lib/offline.ts).
const CACHE = 'cross-du-college-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // database, fonts, auth: untouched
  if (url.pathname.startsWith('/api/') || url.pathname.includes('serverFn')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request) || await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match('/');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
