var CACHE_NAME = 'llmimagecreator-v1';
var STATIC_CACHE = 'static-v1';
var CDN_CACHE = 'cdn-v1';

var STATIC_ASSETS = [
    '/',
    '/index.html',
    '/openrouter.js',
    '/prompt.js',
    '/storage.js',
    '/ui.js',
    '/agent.js'
];

var CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(function(cache) {
            return cache.addAll(STATIC_ASSETS);
        }).then(function() {
            return caches.open(CDN_CACHE);
        }).then(function(cache) {
            return Promise.all(
                CDN_URLS.map(function(url) {
                    return fetch(url, { mode: 'cors' }).then(function(response) {
                        if (response.ok) {
                            return cache.put(url, response);
                        }
                    }).catch(function() {
                    });
                })
            );
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== STATIC_CACHE && cacheName !== CDN_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    var url = event.request.url;

    if (url.includes('openrouter.ai/api/')) {
        event.respondWith(
            fetch(event.request).catch(function() {
                return new Response(JSON.stringify({ error: 'Network unavailable' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    if (url.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            caches.open(CDN_CACHE).then(function(cache) {
                return cache.match(event.request).then(function(response) {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(function(networkResponse) {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(function() {
                        return new Response('Offline - CDN resource not cached', { status: 503 });
                    });
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request).then(function(networkResponse) {
                if (networkResponse && networkResponse.type === 'basic') {
                    var responseToCache = networkResponse.clone();
                    caches.open(STATIC_CACHE).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
        }).catch(function() {
            if (event.request.destination === 'document') {
                return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
        })
    );
});
