/* =========================================================
   K&N Packers and Movers — Service Worker
   Provides:
     • Offline support (cached pages)
     • Faster repeat visits (cache-first strategy)
     • PWA install prompt eligibility
   ========================================================= */

const CACHE_VERSION = 'kn-v1.0.0';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Files that must be available offline (the "app shell")
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/complaint.html',
  '/styles.css',
  '/complaint.css',
  '/script.js',
  '/complaint.js',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon.png',
  // Brand assets
  '/images/kn-logo.png',
  '/images/kn-logo-medium.png',
  '/images/kn-logo-180.png',
  '/images/kn-logo-64.png',
  '/images/kn-logo-32.png',
  // Apple touch icons
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-167x167.png',
  '/apple-touch-icon-180x180.png',
  // Android chrome icons
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/android-chrome-192x192-maskable.png',
  '/android-chrome-512x512-maskable.png',
  // Microsoft tiles
  '/mstile-150x150.png',
  '/mstile-310x150.png',
  '/mstile-70x70.png',
  // iOS splash (one per device, browser preloads based on media query)
  '/apple-splash-640x960.png',
  '/apple-splash-750x1334.png',
  '/apple-splash-1242x2208.png',
  '/apple-splash-1125x2436.png',
  '/apple-splash-828x1792.png',
  '/apple-splash-1242x2688.png',
  '/apple-splash-1080x2340.png',
  '/apple-splash-1170x2532.png',
  '/apple-splash-1284x2778.png',
  '/apple-splash-1179x2556.png',
  '/apple-splash-1290x2796.png',
  '/apple-splash-1536x2048.png',
  '/apple-splash-1668x2388.png',
  '/apple-splash-2048x2732.png',
  // Critical hero + service card images
  '/images/kn-hero.webp',
  '/images/kn-hero.jpg',
  '/images/kn-hero-medium.webp',
  '/images/kn-hero-medium.jpg',
  '/images/kn-hero-small.webp',
  '/images/kn-hero-small.jpg',
];

// ============== Install: pre-cache the app shell ==============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate new SW immediately
  );
});

// ============== Activate: clean up old caches ==============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim()) // take control of all open tabs
  );
});

// ============== Fetch: cache-first with network fallback ==============
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests (chrome-extension://, etc.)
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // For navigations (HTML pages) — try network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh page
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // For static assets — cache-first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache successful responses for next time
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // If both cache and network fail, return a fallback for images
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#E6EAF2"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#5A6478" font-family="sans-serif" font-size="14">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          // For everything else, just fail silently
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ============== Listen for messages from the page ==============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============== Notify clients when a new SW is activated ==============
self.addEventListener('activate', () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
    });
  });
});
