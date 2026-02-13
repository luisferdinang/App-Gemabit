const CACHE_NAME = 'gemabit-v4-hotfix-session';
const ASSETS = [
  '/',
  '/index.html',
  'https://i.ibb.co/kVhqQ0K9/gemabit.png',
  'https://i.ibb.co/JWvYtPhJ/minibit-1.png',
  'https://i.ibb.co/VY6QpY56/supergemabit.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Ignorar peticiones que no sean GET, que sean para Supabase, o que no sean http/https (extensiones)
  if (event.request.method !== 'GET' || url.hostname.includes('supabase.co') || !url.protocol.startsWith('http')) {
    return;
  }

  // ... (Asset caching remains the same) ...

  // 3. Network-First para navegación (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        // Clonar la respuesta ANTES de consumirla
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 4. Stale-While-Revalidate para otros recursos
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Clonar la respuesta ANTES de consumirla
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(err => console.log("Fetch failed, using cache", err));

      return cachedResponse || fetchPromise;
    })
  );
});