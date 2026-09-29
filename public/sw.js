// Service Worker for Controle de Presença BMF4 (Medicina)
const CACHE_NAME = 'bmf4-presenca-APP_VERSION_2024_01';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32.png',
  '/favicon-64.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/app-icon.png'
];

// Listen for SKIP_WAITING message to trigger instant hot upgrade
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Install Event - Pre-cache core shell and skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some assets failed (will cache on demand):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network First with Cache Fallback for navigation and static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not intercept or cache API, WebSocket, Firestore, Vite dev scripts, or node_modules
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.search.includes('v=') ||
    url.search.includes('import') ||
    url.search.includes('t=') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // Network First strategy with fallback to cache for offline capabilities
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for GET requests (except html / root to ensure newest version is loaded)
        if (
          response && 
          response.status === 200 && 
          response.type === 'basic' && 
          !url.pathname.endsWith('.html') && 
          url.pathname !== '/'
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigation request fails offline, fallback to cached index.html
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
          return new Response('Modo Offline - Controle de Presença BMF4', {
            status: 503,
            statusText: 'Offline',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        }
        return new Response('', { status: 408, statusText: 'Request timed out or offline' });
      })
  );
});
