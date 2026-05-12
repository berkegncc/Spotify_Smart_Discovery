// Spotify Smart Discovery — Service Worker
// Strateji: statik asset'ler için cache-first, /api/ çağrıları her zaman network.
// Versiyon değiştiğinde eski cache otomatik temizlenir.

const CACHE_NAME = 'spotify-discovery-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(names.map(n => n !== CACHE_NAME ? caches.delete(n) : null))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API çağrıları service worker'dan geçer ama cache'lenmez (her zaman canlı veri).
    if (url.pathname.startsWith('/api/')) return;

    // CDN'leri (örn. tailwind) kendi origin'imizde olmadığı için zaten by-pass — opaque response.
    if (url.origin !== self.location.origin) return;

    // GET dışındakilere dokunma
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(res => {
                // Sadece başarılı same-origin yanıtlarını cache'e koy
                if (res && res.ok && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return res;
            }).catch(() => cached); // network olmayınca son cache (varsa)
        })
    );
});
