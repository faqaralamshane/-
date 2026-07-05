const CACHE_NAME = 'faqar-app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install Event: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: network first for pages, stale-while-revalidate for static assets, with fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests and external / non-http schemes
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle SPA routing and core HTML: Network-first to ensure latest code is retrieved when online
  if (request.mode === 'navigate' || request.url.endsWith('.html') || request.url === self.location.origin + '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached index.html or root
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // General static assets (JS, CSS, images, SVGs, fonts): Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache immediately, then update cache in background
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {/* Ignore background fetch errors when offline */});
        
        return cachedResponse;
      }

      // Not in cache: fetch from network and cache for future offline visits
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      }).catch((err) => {
        console.warn('[Service Worker] Fetch failed offline for:', request.url);
        // Fallback for image requests when completely offline
        if (request.url.endsWith('.svg') || request.url.endsWith('.png')) {
          return caches.match('/icon.svg');
        }
      });
    })
  );
});
