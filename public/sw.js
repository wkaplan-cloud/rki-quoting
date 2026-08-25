// QuotingHub service worker
//   1. Staff push notifications (unchanged since the original version)
//   2. Offline support for Studio boards
//
// ── Rollout safety ──────────────────────────────────────────────────────────
// There is deliberately NO skipWaiting()/clients.claim() here. A new version
// installs into the "waiting" state and only takes over once every tab under
// this scope has been closed. A designer with a board open while this deploys
// keeps running the worker they started with, and the caches below are only
// created and cleaned up in `activate` — after the old worker has been released.
// Nothing about an in-flight editing session changes mid-session.

// Bumped to v2 to drop `qh-images-v1`, which on some devices holds opaque
// responses that can never satisfy the editor's CORS image loads — see
// imageCacheFirst below for the whole story.
const VERSION = 'v2'
const SHELL_CACHE = `qh-shell-${VERSION}`
const RSC_CACHE = `qh-rsc-${VERSION}`
const STATIC_CACHE = `qh-static-${VERSION}`
const IMAGE_CACHE = `qh-images-${VERSION}`
// Deliberately NOT version-stamped and NOT matched by OURS below: this holds
// the background-removal model, which is neither user data nor build output.
// Its URLs are already pinned to the library version, so entries can never go
// stale — and a shared iPad must not re-download ~40MB on every sign-out or
// every deploy.
const MODEL_CACHE = 'qh-model'
const MODEL_CACHE_MAX = 40
const OURS = /^qh-(shell|rsc|static|images)-/

// Board images are content-addressed and never change, so they can be cached
// hard. Trimmed oldest-first so a heavy board can't fill the device.
const IMAGE_CACHE_MAX = 600

self.addEventListener('install', function () {
  // No precache list on purpose: Next.js asset names are build-specific, and a
  // wrong guess would fail the whole install. The caches fill from real traffic.
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          const stale =
            OURS.test(key) &&
            key !== SHELL_CACHE &&
            key !== RSC_CACHE &&
            key !== STATIC_CACHE &&
            key !== IMAGE_CACHE
          return stale ? caches.delete(key) : undefined
        })
      )
    })
  )
})

// Signed out, or switching account on a shared iPad: drop every cached page and
// picture so the next person can't pull the previous one's board out of cache.
self.addEventListener('message', function (event) {
  if (!event.data || event.data.type !== 'QH_CLEAR_CACHES') return
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) { return OURS.test(key) ? caches.delete(key) : undefined }))
    })
  )
})

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', function(event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}

  const title = data.title || 'QuotingHub'
  const options = {
    body:    data.body  || '',
    icon:    '/logo.png',
    badge:   '/logo.png',
    tag:     data.tag   || 'qh-reminder',
    renotify: true,
    data:    { url: data.url || '/supplier-portal/staff-home' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/supplier-portal/staff-home'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      // If app is already open, focus it
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// ── Offline fetch handling ──────────────────────────────────────────────────

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/pdfjs/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/manifest.json'
  )
}

function isBoardImage(request, url) {
  if (request.destination !== 'image') return false
  // Supabase Storage public objects, plus Next's image optimiser
  return url.pathname.includes('/storage/v1/object/') || url.pathname.startsWith('/_next/image')
}

// The background-removal model (~40MB of ONNX/WASM) is fetched from imgly's
// CDN, so nothing we control was caching it — it depended entirely on the
// browser's HTTP cache. iOS evicts that aggressively, which meant an iPad
// could re-download the whole model before a removal could even start, and
// removal never worked offline at all. Caching it here is what actually makes
// good on "downloads once per device".
function isModelAsset(url) {
  return url.hostname === 'staticimgly.com'
}

function isStudioNavigation(request, url) {
  return (
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/studio')
  )
}

// Moving between Studio pages in an already-open tab is a React Server
// Component fetch, not a document navigation, so it needs its own handling or
// every in-app link dies the moment the signal does. Cached under the exact
// request URL (the `_rsc` query is part of the key) — never `ignoreSearch`,
// which would happily hand an RSC request the HTML cached for the same path.
function isStudioRsc(request, url) {
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/studio') &&
    (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1')
  )
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

// Studio pages: network first, so an online designer always gets fresh server
// data, with the last good copy kept as the offline fallback. Falling back to a
// stale page is safe — the editor merges anything unsynced from IndexedDB over
// the top before the designer can touch it.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    // Never cache a redirect (a bounce to /login is not a board page), and let
    // a rejected put — Vary: *, quota, private mode — pass silently.
    if (response && response.ok && response.type === 'basic' && !response.redirected) {
      try {
        await cache.put(request, response.clone())
      } catch {}
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

// Build assets are content-hashed and immutable. Same-origin only, so a
// response here is always `basic` — never opaque.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone())
    } catch {}
  }
  return response
}

// ── Board images ────────────────────────────────────────────────────────────
// These come off Supabase Storage, so they are CROSS-ORIGIN, and the app asks
// for the very same URL two different ways:
//
//   * the canvas, via images.ts loadImage(), sets crossOrigin="anonymous" —
//     mandatory, because stage.toDataURL() throws on a canvas tainted by a
//     non-CORS image, which is what PDF export and slide thumbnails rely on;
//   * the Assets / Specs / Pieces panels, as plain <img> tags — a `no-cors`
//     request, whose response is OPAQUE.
//
// Two things went wrong with a single shared cache-first strategy:
//
//   1. Cache.put() REJECTS on an opaque response (status 0). That rejection
//      propagated out through respondWith(), which the browser reports as a
//      network error — so the picture failed to load at all.
//   2. An opaque response that did get stored can never satisfy a later CORS
//      request. The browser rejects it, and because cache-first never
//      revalidates, the entry stayed poisoned for good: the picture was
//      permanently a grey frame on that device, immune to reload.
//
// Both are invisible on a laptop that never registered the worker, and stick
// hard on an iPad that did. The rules now: only ever STORE a response CORS can
// reuse, treat any leftover opaque entry as a miss so the cache heals itself,
// and never let a caching problem take the image down with it.
async function imageCacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)
  // A `cors` or `basic` cached response satisfies both kinds of request; an
  // opaque one satisfies only no-cors, so re-fetch rather than hand it to the
  // canvas and have the load fail.
  if (cached && (cached.type !== 'opaque' || request.mode !== 'cors')) return cached

  let response
  try {
    response = await fetch(request)
  } catch (err) {
    // Offline: anything cached beats a broken image, opaque included
    if (cached) return cached
    throw err
  }

  // `ok` is false for an opaque response (status 0), so this stores only what
  // is genuinely reusable. An image that stays uncacheable still displays —
  // it simply is not available offline.
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone())
      trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX)
    } catch {}
  }
  return response
}

// Model chunks are immutable and version-pinned by URL. Same defensive shape
// as imageCacheFirst: never let a caching failure take the request down.
async function modelCacheFirst(request) {
  const cache = await caches.open(MODEL_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone())
      trimCache(MODEL_CACHE, MODEL_CACHE_MAX)
    } catch {}
  }
  return response
}

self.addEventListener('fetch', function (event) {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  if (isStudioNavigation(request, url)) {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }
  if (isStudioRsc(request, url)) {
    event.respondWith(networkFirst(request, RSC_CACHE))
    return
  }
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }
  if (isBoardImage(request, url)) {
    event.respondWith(imageCacheFirst(request))
    return
  }
  if (isModelAsset(url)) {
    event.respondWith(modelCacheFirst(request))
    return
  }
  // Everything else — API routes, auth, RSC payloads, other pages — is left to
  // the network exactly as before.
})
