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

const VERSION = 'v1'
const SHELL_CACHE = `qh-shell-${VERSION}`
const RSC_CACHE = `qh-rsc-${VERSION}`
const STATIC_CACHE = `qh-static-${VERSION}`
const IMAGE_CACHE = `qh-images-${VERSION}`
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

// Build assets are content-hashed and immutable
async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && (response.ok || response.type === 'opaque')) {
    await cache.put(request, response.clone())
    if (max) trimCache(cacheName, max)
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
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_CACHE_MAX))
    return
  }
  // Everything else — API routes, auth, RSC payloads, other pages — is left to
  // the network exactly as before.
})
