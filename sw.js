// =====================================================
// GTD — Service Worker
// Compatible con Safari iOS 11.3+
// Estrategia: Cache-First para funcionar 100% offline
// =====================================================

const CACHE_NAME = 'gtd-ios-v1';

// Archivos esenciales que se cachean en la instalación
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-152.png',
  './icon-167.png',
  './icon-180.png'
];

// ===== INSTALL: precachear todos los assets =====
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cachear cada archivo individualmente para que un fallo
      // no rompa toda la instalación
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('No se pudo cachear:', url, err);
          });
        })
      );
    }).then(function() {
      // Activar inmediatamente sin esperar a que se cierren tabs
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE: limpiar versiones antiguas del caché =====
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      // Tomar control de todos los clientes abiertos inmediatamente
      return self.clients.claim();
    })
  );
});

// ===== FETCH: Cache-First =====
// 1. Buscar en caché
// 2. Si no está en caché, ir a la red y guardar la respuesta
// 3. Si no hay red, devolver el index.html cacheado como fallback
self.addEventListener('fetch', function(event) {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // Solo manejar peticiones del mismo origen (no CDNs externos)
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      // Si está en caché, devolverlo inmediatamente
      if (cachedResponse) {
        return cachedResponse;
      }

      // No está en caché: ir a la red
      return fetch(event.request).then(function(networkResponse) {
        // Guardar en caché si la respuesta es válida
        if (networkResponse && networkResponse.status === 200) {
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(function() {
        // Sin red y sin caché específico: devolver index.html
        return caches.match('./index.html');
      });
    })
  );
});

// ===== MENSAJE: permitir forzar actualización desde la app =====
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
