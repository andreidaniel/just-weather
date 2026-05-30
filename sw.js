const CACHE_NAME = 'just-weather-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './privacy.html',
  './style.css',
  './screenshot-mobile.png',
  './screenshot-desktop.png',
  './manifest.json',
  './manifest-ro.json',
  './manifest-en.json',
  './manifest-es.json',
  './manifest-fr.json',
  './manifest-zh.json',
  './icon.png',
  './icon-512.png',
  './icon-maskable.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll with caution since if any of them fails, the entire installation fails.
      // We will map over resources and add them individually to make it resilient.
      const cachePromises = ASSETS_TO_CACHE.map((asset) => {
        return cache.add(asset).catch((err) => {
          console.warn(`Failed to cache asset: ${asset}`, err);
        });
      });
      return Promise.all(cachePromises);
    })
  );
});

// Message Event to force activation of waiting Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network-first for APIs, Cache-first for static assets)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude chrome-extension requests and non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // For API calls (open-meteo, openstreetmap, geojs), try network first, do not cache
  if (
    url.origin.includes('api.open-meteo.com') ||
    url.origin.includes('openstreetmap.org') ||
    url.origin.includes('geojs.io')
  ) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.log('API request failed, device is offline.', err);
        return caches.match(event.request);
      })
    );
    return;
  }

  // For static assets, try cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache new fetched resources if they are valid basic requests
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Return index.html if the resource was not found and it's a navigation request
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
