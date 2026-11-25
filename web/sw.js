const CACHE_NAME = 'atoz-offline-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=9',
  './app.js?v=9',
  './data.js?v=9',
  './logo.png',
  './favicon.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';
  if (url.endsWith('.zip') || url.endsWith('.exe') || url.endsWith('.json')) {
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
