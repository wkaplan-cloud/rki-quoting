'use client'
import { pruneBoardSnapshots } from './offlineDb'

// ── Service worker lifecycle ────────────────────────────────────────────────
// The worker at /sw.js does two unrelated jobs: staff push notifications (which
// the supplier portal already registers it for) and offline caching for Studio
// boards. Registering it here means a designer who never opens the staff home
// still gets the board shell and images cached for offline use.
//
// A new worker version installs into "waiting" and takes over only once every
// tab under this scope is closed, so this never disturbs a session in progress.

export function registerOfflineWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
  void pruneBoardSnapshots()
}

// Called on sign-out. Drops the cached Studio pages and images so the next
// person on a shared iPad can't pull the previous designer's board out of
// cache. Deliberately does NOT touch IndexedDB: that holds work which has not
// reached the server yet, and signing out must never be the thing that
// destroys it.
export async function clearStudioOfflineCaches(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    reg?.active?.postMessage({ type: 'QH_CLEAR_CACHES' })
  } catch {
    // Nothing to clean up if the worker was never installed
  }
}
