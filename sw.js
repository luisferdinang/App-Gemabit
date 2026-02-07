const CACHE_NAME = 'gemabit-v2';
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
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});