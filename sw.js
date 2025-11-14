const CACHE_NAME = 'chatpoint-v9';
const urlsToCache = [
  '/',
  '/index.html',
  '/items.html',
  '/cart.html',
  '/login.html',
  '/orders.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
  // Images auto cached by browser
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});