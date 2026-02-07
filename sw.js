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

  // Estrategia: Network First (Red primero, si falla, caché)
  // Esto asegura que los parches de código lleguen al teléfono de inmediato
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar en caché para uso offline posterior
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clonedResponse);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde caché
        return caches.match(event.request);
      })
  );
});