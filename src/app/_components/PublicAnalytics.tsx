'use client'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

// Vercel Web Analytics for the public marketing site only. Its main job is
// showing which visitors arrive from AI assistants (chatgpt.com, perplexity.ai,
// gemini.google.com…) and search. App routes are dropped so client and project
// URLs never leave the app and logged-in use doesn't burn the event quota.
const PUBLIC_PREFIXES = [
  '/pricing',
  '/faq',
  '/blog',
  '/trades',
  '/manufacturer',
  '/interior-design-software-',
  '/quoting-software-',
  '/privacy',
  '/terms',
]

function isPublic(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return isPublic(new URL(event.url).pathname) ? event : null
}

export function PublicAnalytics() {
  return <Analytics beforeSend={beforeSend} />
}
