/**
 * Remember-me bookkeeping for the designer portal.
 *
 * Two modes, both enforced client-side by <SessionGuard />:
 *  - "Remember me" — `rki_remember_until` holds an absolute expiry in localStorage.
 *  - Session only   — no expiry; the session must not survive closing the browser.
 *
 * Session-only used to be tracked purely with sessionStorage, which is per-tab:
 * opening the app in a second tab (or following a link from an email) looked
 * identical to a browser restart, so the user was signed out of every tab. To
 * tell those apart we keep a heartbeat in localStorage that every open tab
 * refreshes. A fresh tab that finds a recent heartbeat is joining a browsing
 * session that is still alive; a stale heartbeat means the browser was closed.
 */

const REMEMBER_KEY = 'rki_remember_until'
const SESSION_ONLY_KEY = 'rki_session_only'
const HEARTBEAT_KEY = 'rki_last_seen'

/** How long after the last open tab disappears we still count as the same browsing session. */
export const HEARTBEAT_STALE_MS = 60_000
const HEARTBEAT_INTERVAL_MS = 15_000

// Every helper is defensive: storage throws in Safari private browsing and
// wherever site data is blocked, and a remember-me preference is never worth
// breaking a login over.

export function rememberFor(days: number) {
  try {
    localStorage.setItem(REMEMBER_KEY, String(Date.now() + days * 86400000))
    sessionStorage.removeItem(SESSION_ONLY_KEY)
  } catch {}
}

export function rememberThisSessionOnly() {
  try {
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.setItem(SESSION_ONLY_KEY, '1')
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
  } catch {}
}

/** Mark this tab as part of the current browsing session. */
export function markTabInSession() {
  try {
    sessionStorage.setItem(SESSION_ONLY_KEY, '1')
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
  } catch {}
}

export function beat() {
  try { localStorage.setItem(HEARTBEAT_KEY, String(Date.now())) } catch {}
}

/** True when another tab was alive recently enough to count as the same browsing session. */
export function browsingSessionIsLive(): boolean {
  try {
    const last = parseInt(localStorage.getItem(HEARTBEAT_KEY) ?? '', 10)
    return Number.isFinite(last) && Date.now() - last < HEARTBEAT_STALE_MS
  } catch {
    return false
  }
}

/** Keeps the heartbeat warm while this tab is open. Returns a cleanup function. */
export function startHeartbeat(): () => void {
  beat()
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS)
  const onHide = () => beat()
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onHide)
  return () => {
    clearInterval(timer)
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onHide)
  }
}

/** Reads the remember-me expiry. `undefined` means storage was unreadable. */
export function readRememberUntil(): number | null | undefined {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const expiry = parseInt(raw, 10)
    return Number.isFinite(expiry) ? expiry : null
  } catch {
    return undefined
  }
}

export function clearRememberUntil() {
  try { localStorage.removeItem(REMEMBER_KEY) } catch {}
}

/** Whether this specific tab has already been marked as part of the session. */
export function tabIsMarked(): boolean {
  try { return sessionStorage.getItem(SESSION_ONLY_KEY) === '1' } catch { return false }
}
