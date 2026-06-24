import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Singleton — safe to call multiple times (Next.js hot-reload safe)
function getFirebaseApp(): App | null {
  if (getApps().length) return getApps()[0]

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null

  try {
    return initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) })
  } catch {
    return null
  }
}

export function getFirebaseMessaging() {
  const app = getFirebaseApp()
  if (!app) return null
  return getMessaging(app)
}
