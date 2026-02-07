const CACHE_NAME = 'gemabit-v3';
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
  // Ignorar peticiones que no sean GET o que sean para Supabase (Auth/API)
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  // Estrategia: Stale-While-Revalidate
  // 1. Responder inmediatamente desde caché (si existe)
  // 2. En paralelo, buscar versión nueva en red y actualizar caché
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});