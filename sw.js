const CACHE_NAME = 'boxing-timer-v1';
const FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});