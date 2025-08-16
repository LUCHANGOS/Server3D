const CACHE_NAME = 'server3d-v1';
const urlsToCache = [
  '/Server3D/',
  '/Server3D/index.html',
  '/Server3D/styles.css',
  '/Server3D/manifest.webmanifest',
  '/Server3D/assets/icons/icon-192.png',
  '/Server3D/assets/icons/icon-512.png',
  // No cachear módulos JS ni Firebase para evitar problemas de actualización
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('SW: All files cached');
        return self.skipWaiting(); // Activar inmediatamente
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // No cachear requests a Firebase, APIs externas o streams
  const url = event.request.url;
  
  if (
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('api.') ||
    url.includes('ws://') ||
    url.includes('wss://') ||
    event.request.method !== 'GET'
  ) {
    return; // Dejar que se procese normalmente
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devolver desde caché si existe, sino fetch desde red
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activated');
      return self.clients.claim(); // Tomar control inmediatamente
    })
  );
});
