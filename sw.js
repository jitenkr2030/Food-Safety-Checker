// FoodSafe AI - Service Worker for PWA functionality
const CACHE_NAME = 'foodsafe-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/scripts/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('[ServiceWorker] Cache install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests and non-GET requests
    if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
        return;
    }

    // Skip requests to camera/microphone APIs
    if (event.request.url.includes('getUserMedia') || event.request.url.includes('mediaDevices')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                if (response) {
                    console.log('[ServiceWorker] Serving from cache:', event.request.url);
                    return response;
                }

                console.log('[ServiceWorker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.log('[ServiceWorker] Fetch failed:', error);
                        
                        // Return offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        // Return offline fallback for other resources
                        throw error;
                    });
            })
    );
});

// Background sync for offline analysis
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-analysis') {
        console.log('[ServiceWorker] Background sync triggered');
        event.waitUntil(doBackgroundAnalysis());
    }
});

async function doBackgroundAnalysis() {
    try {
        // Get pending analyses from IndexedDB or localStorage
        const pendingAnalyses = await getPendingAnalyses();
        
        for (const analysis of pendingAnalyses) {
            // Process analysis when back online
            await processOfflineAnalysis(analysis);
        }
        
        // Clear processed analyses
        await clearPendingAnalyses();
    } catch (error) {
        console.log('[ServiceWorker] Background analysis failed:', error);
    }
}

async function getPendingAnalyses() {
    // This would integrate with IndexedDB or localStorage
    // For now, return empty array
    return [];
}

async function processOfflineAnalysis(analysis) {
    // Process the analysis and store results
    console.log('[ServiceWorker] Processing offline analysis:', analysis);
}

async function clearPendingAnalyses() {
    // Clear processed analyses
    console.log('[ServiceWorker] Cleared pending analyses');
}

// Push notifications for safety alerts
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received:', event);
    
    const options = {
        body: 'New food safety update available!',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        },
        actions: [
            {
                action: 'explore',
                title: 'View Details',
                icon: '/action-explore.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/action-close.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('FoodSafe AI', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click received:', event);
    
    event.notification.close();

    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle app shortcuts
self.addEventListener('activate', (event) => {
    // Handle app shortcuts
    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SHORTCUT_LAUNCH') {
            const shortcut = event.data.shortcut;
            console.log('[ServiceWorker] Shortcut launched:', shortcut);
            
            if (shortcut === 'analyze') {
                event.waitUntil(
                    clients.openWindow('/#analyze')
                );
            } else if (shortcut === 'history') {
                event.waitUntil(
                    clients.openWindow('/#history')
                );
            }
        }
    });
});

// Share target handler
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHARE_TARGET') {
        console.log('[ServiceWorker] Shared target received:', event.data);
        event.waitUntil(
            clients.matchAll().then((clients) => {
                const client = clients.find((c) => c.url.includes('/'));
                if (client) {
                    client.postMessage({
                        type: 'SHARE_TARGET_FILES',
                        files: event.data.files
                    });
                    client.focus();
                }
            })
        );
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('[ServiceWorker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[ServiceWorker] Unhandled promise rejection:', event.reason);
});