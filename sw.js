// ============================================================
// PROPHETIC FLAMES OF FIRE MINISTRIES - Service Worker
// Version: 1.0.0
// Description: Handles push notifications, offline caching,
// and background sync for the church website
// ============================================================

const CACHE_NAME = 'pffm-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/ministries.html',
  '/services.html',
  '/live.html',
  '/contact.html',
  '/donation.html',
  '/prayer-wall.html',
  '/login.html',
  '/signup.html',
  '/profile.html',
  '/admin.html',
  '/offline.html',
  '/favicon.ico'
];

// CSS & JS files to cache
const DYNAMIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// ── INSTALL EVENT ──
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        // Cache static assets
        return cache.addAll([...STATIC_ASSETS, ...DYNAMIC_ASSETS]);
      })
      .then(() => {
        console.log('[SW] Cache complete!');
        // Force activation immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache error:', error);
      })
  );
});

// ── ACTIVATE EVENT ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated!');
        // Take control of all clients
        return self.clients.claim();
      })
  );
});

// ── FETCH EVENT ──
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and Firebase API calls
  if (request.method !== 'GET' || 
      url.pathname.includes('/__/') || 
      url.pathname.includes('/firestore/') ||
      url.pathname.includes('/auth/')) {
    return event.respondWith(fetch(request));
  }
  
  // Handle HTML page requests - network first, fallback to cache
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for offline use
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, show offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Handle static assets - cache first, network fallback
  if (request.url.includes('.css') || 
      request.url.includes('.js') || 
      request.url.includes('.jpg') || 
      request.url.includes('.png') || 
      request.url.includes('.svg') || 
      request.url.includes('.ico') ||
      request.url.includes('fonts.googleapis.com') ||
      request.url.includes('cdnjs.cloudflare.com')) {
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached response, but update cache in background
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(request, response);
                    });
                }
              })
              .catch(() => { /* Ignore fetch errors */ });
            return cachedResponse;
          }
          
          // If not in cache, fetch from network
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return response;
            });
        })
    );
    return;
  }
  
  // Default: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for future offline use
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If request is for an image, return a placeholder
            if (request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#E8F4FD"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="16" fill="#4A90D9">Image Unavailable</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return new Response('Network error occurred', { status: 503 });
          });
      })
  );
});

// ── PUSH NOTIFICATION EVENT ──
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let data = {
    title: 'Prophetic Flames of Fire Ministries',
    body: 'New update from the ministry',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    url: '/',
    requireInteraction: true,
    actions: [
      { action: 'watch', title: '📺 Watch Live' },
      { action: 'visit', title: '🌐 Visit Site' }
    ]
  };
  
  // Parse notification data
  if (event.data) {
    try {
      const parsedData = event.data.json();
      data = { ...data, ...parsedData };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body || 'Check out the latest from Prophetic Flames of Fire Ministries',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: data.requireInteraction !== false,
    actions: data.actions || [
      { action: 'watch', title: '📺 Watch Live' },
      { action: 'visit', title: '🌐 Visit Site' }
    ],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    tag: data.tag || 'pffm-notification',
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Prophetic Flames', options)
  );
});

// ── NOTIFICATION CLICK EVENT ──
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  const action = event.action;
  
  // Handle action clicks
  let targetUrl = url;
  if (action === 'watch') {
    targetUrl = '/live.html';
  } else if (action === 'visit') {
    targetUrl = '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window/tab open with the target URL
        for (let client of windowClients) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── SYNC EVENT ──
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-testimonies') {
    event.waitUntil(syncTestimonies());
  } else if (event.tag === 'sync-prayer-requests') {
    event.waitUntil(syncPrayerRequests());
  }
});

// ── MESSAGE EVENT ──
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── SYNC FUNCTIONS ──
async function syncTestimonies() {
  console.log('[SW] Syncing offline testimonies...');
  try {
    const cache = await caches.open('pffm-offline');
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/testimonies')) {
        const response = await cache.match(request);
        if (response) {
          const data = await response.json();
          // Send to Firebase
          await fetch('https://firestore.googleapis.com/v1/projects/prophetic-flames-fire/databases/(default)/documents/testimonials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                name: { stringValue: data.name || 'Anonymous' },
                text: { stringValue: data.text || '' },
                location: { stringValue: data.location || '' },
                rating: { integerValue: data.rating || 5 },
                createdAt: { timestampValue: new Date().toISOString() }
              }
            })
          });
          // Remove from cache after sync
          await cache.delete(request);
        }
      }
    }
    console.log('[SW] Testimonies synced successfully');
  } catch (error) {
    console.error('[SW] Sync error:', error);
  }
}

async function syncPrayerRequests() {
  console.log('[SW] Syncing offline prayer requests...');
  // Similar implementation for prayer requests
}

// ── UNHANDLED REJECTION HANDLER ──
self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] Unhandled rejection:', event.reason);
});

// ── PERIODIC BACKGROUND SYNC (if supported) ──
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-content') {
      event.waitUntil(updateContent());
    }
  });
}

async function updateContent() {
  console.log('[SW] Periodic sync: Updating content...');
  // Fetch latest updates and cache them
  const urls = ['/', '/live.html', '/index.html'];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(url, response);
      }
    } catch (e) {
      console.error('[SW] Update error for', url, e);
    }
  }
}

console.log('[SW] Service Worker initialized successfully!');