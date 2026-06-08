// QuotingHub Staff Push Notification Service Worker

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
