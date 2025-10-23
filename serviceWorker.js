/* ============================================================
    Service Worker de EcoLink
   ------------------------------------------------------------
   Su objetivo es:
   1️Acelerar la carga de la app (caché local).
   2 Permitir uso básico sin conexión.
   3 Actualizar automáticamente cuando haya nueva versión.
   ============================================================ */

// Cada vez que cambies este archivo o algún asset, sube la versión.
// Esto obliga al navegador a limpiar cachés antiguos.
const CACHE_VERSION = 'ecolink-shell-v10.14';

/* ------------------------------------------------------------
   APP SHELL
   ------------------------------------------------------------
   Lista de archivos locales (HTML, CSS, JS, imágenes)
   que conforman la base mínima para que la app funcione
   incluso sin conexión a internet.
   ------------------------------------------------------------ */
const SHELL_ASSETS = [
  // HTML principal (pantallas base)
  '/',
  '/Inicio.html',
  '/login.html',
  '/CrearUsuario.html',
  '/DashboardPrincipal.html',
  '/PanelOrganizaciones.html',
  '/Admin.html',

  // CSS
  '/css/Inicio.css',
  '/css/Login.css',
  '/css/CrearUsuario.css',
  '/css/DashboardPrincipal.css',
  '/css/PanelOrganizaciones.css',
  '/css/Admin.css',

  // JS (archivos de funcionalidad local)
  '/js/E_Inicio.js',
  '/js/E_Login.js',
  '/js/Login.js',
  '/js/CrearUsuario.js',
  '/js/DashboardPrincipal.js',
  '/js/panelOrg.js',
  '/js/adminPanel.js',
  '/js/firebase.js',
  '/js/uploaderCloudinary.js',

  // Recursos locales (imágenes, íconos)
  '/assets/logo.png',
  '/assets/fak.png',

  // Configuración PWA
  '/manifest.json',
];

/* ------------------------------------------------------------
   CACHÉS ADICIONALES (Runtime)
   ------------------------------------------------------------
   Se crean en ejecución para almacenar recursos que no están
   en el App Shell (por ejemplo, imágenes externas).
   ------------------------------------------------------------ */
const RUNTIME_STATIC_CACHE = 'ecolink-static-v2';  // CSS/JS locales cargados en runtime
const RUNTIME_IMG_CACHE    = 'ecolink-img-v2';     // Imágenes externas (Cloudinary, etc.)

/* ============================================================
   EVENTO: INSTALL
   ------------------------------------------------------------
   Ocurre la primera vez que el SW se instala o cuando cambias
   CACHE_VERSION. Descarga los archivos base (App Shell).
   ============================================================ */
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      try {
        // Precachea todos los assets definidos arriba
        await cache.addAll(SHELL_ASSETS);
      } catch (err) {
        // Si alguno falla (404 o URL mal escrita), se registra en consola
        console.warn('[SW] Algunos assets no se pudieron precachear:', err);
      }
    })
  );

  // Fuerza la activación inmediata de la nueva versión del SW
  self.skipWaiting();
});

/* ============================================================
   EVENTO: ACTIVATE
   ------------------------------------------------------------
   Elimina cachés antiguos y toma el control de todas las
   pestañas abiertas que usen esta app.
   ============================================================ */
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    // Obtiene todas las claves de caché guardadas
    const keys = await caches.keys();

    // Filtra las que NO son la versión actual y las borra
    await Promise.all(
      keys
        .filter(k => ![CACHE_VERSION, RUNTIME_STATIC_CACHE, RUNTIME_IMG_CACHE].includes(k))
        .map(k => caches.delete(k))
    );

    // Reclama control sobre todas las pestañas activas
    await self.clients.claim();
  })());
});

/* ============================================================
   MENSAJE: SKIP_WAITING
   ------------------------------------------------------------
   Permite que la página le diga al SW: “actualízate ya”
   sin esperar a cerrar todas las pestañas.
   ============================================================ */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ============================================================
   FUNCIONES AUXILIARES DE CACHE
   ------------------------------------------------------------
   Se utilizan en las estrategias de cacheo (networkFirst,
   cacheFirst, staleWhileRevalidate).
   ============================================================ */

// Guarda una respuesta en el caché (si es válida)
async function putInCache(cacheName, request, response) {
  try {
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
  } catch (_) {}
  return response;
}

/* ------------------------------------------------------------
   Estrategia: Network First
   ------------------------------------------------------------
   1 Intenta obtener la versión más reciente desde la red.
   2 Si falla (sin conexión), usa la versión guardada.
   Ideal para: HTML o contenido que cambia seguido.
   ------------------------------------------------------------ */
async function networkFirst(request, fallbackCacheName) {
  try {
    const fresh = await fetch(request); // busca desde la red
    await putInCache(fallbackCacheName || CACHE_VERSION, request, fresh);
    return fresh;
  } catch (_) {
    // Si falla la red, intenta devolver lo que haya en caché
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si es una navegación (HTML) y no hay caché, muestra Inicio.html
    if (request.mode === 'navigate') {
      return caches.match('/Inicio.html');
    }
    throw _;
  }
}

/* ------------------------------------------------------------
   Estrategia: Cache First
   ------------------------------------------------------------
   1 Usa primero el recurso guardado (si existe).
   2 Descarga una versión nueva en segundo plano.
   Ideal para: JS, CSS, imágenes locales.
   ------------------------------------------------------------ */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Mientras tanto, actualiza en background
    fetch(request).then(res => putInCache(cacheName || RUNTIME_STATIC_CACHE, request, res)).catch(()=>{});
    return cached; // devuelve la versión vieja
  }

  // Si no hay caché, descarga desde red y guarda
  const fresh = await fetch(request);
  return putInCache(cacheName || RUNTIME_STATIC_CACHE, request, fresh);
}

/* ------------------------------------------------------------
   Estrategia: Stale-While-Revalidate
   ------------------------------------------------------------
   1 Devuelve la versión cacheada (si existe).
   2 Mientras tanto, descarga una nueva versión en segundo plano.
   Ideal para: imágenes externas (Cloudinary, etc.).
   ------------------------------------------------------------ */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName || RUNTIME_IMG_CACHE);
  const cachedPromise = cache.match(request);
  const networkPromise = fetch(request).then(res => putInCache(cacheName || RUNTIME_IMG_CACHE, request, res));

  const cached = await cachedPromise;
  if (cached) {
    // Actualiza en segundo plano pero responde rápido al usuario
    networkPromise.catch(()=>{});
    return cached;
  }

  // Si no hay nada cacheado, espera a la red
  return networkPromise;
}

/* ============================================================
    EVENTO: FETCH
   ------------------------------------------------------------
   Intercepta TODAS las solicitudes de red que hace la app
   y decide qué estrategia usar según el tipo de archivo.
   ============================================================ */
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  /* --------------------------------------------------------
     Caso 1️: HTML o Navegaciones
     --------------------------------------------------------
     Usamos "Network First" para evitar servir versiones
     antiguas del HTML (pantallas base).
     -------------------------------------------------------- */
  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    evt.respondWith(networkFirst(req, CACHE_VERSION));
    return;
  }

  /* --------------------------------------------------------
     Caso 2️: Recursos del mismo origen (CSS, JS, imágenes)
     --------------------------------------------------------
     Usamos "Cache First" para velocidad y ahorro de datos.
     -------------------------------------------------------- */
  if (url.origin === self.location.origin) {
    if (['style', 'script', 'image', 'font'].includes(req.destination)) {
      evt.respondWith(cacheFirst(req, RUNTIME_STATIC_CACHE));
      return;
    }
    // Por defecto, también cache-first
    evt.respondWith(cacheFirst(req, RUNTIME_STATIC_CACHE));
    return;
  }

  /* --------------------------------------------------------
     Caso 3️: Imágenes externas (Cloudinary)
     --------------------------------------------------------
     Usamos "Stale While Revalidate" para mostrar rápido
     lo cacheado y actualizar en segundo plano.
     -------------------------------------------------------- */
  if (url.hostname.endsWith('res.cloudinary.com')) {
    evt.respondWith(staleWhileRevalidate(req, RUNTIME_IMG_CACHE));
    return;
  }

  /* --------------------------------------------------------
     Caso 4: Otros externos (APIs, CDNs, etc.)
     --------------------------------------------------------
     Los dejamos pasar directo a la red, sin cachear.
     -------------------------------------------------------- */
  // evt.respondWith(fetch(req)); // (el navegador maneja por defecto)
});
