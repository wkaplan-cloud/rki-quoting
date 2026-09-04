import { NextRequest, NextResponse } from 'next/server'

// Lightweight in-memory rate limiter for public, unauthenticated endpoints.
//
// Keyed by client IP + a bucket name, using a fixed time window. State lives in
// the module scope of a single serverless instance, so under heavy fan-out
// across many instances the effective limit is higher than the nominal one.
// It is a first line of defence against scripted abuse (email bombing, upload
// floods), not a hard global quota. For a strict global limit, back this with a
// shared store (e.g. Upstash Redis) later — the call sites won't need to change.

type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()

// Opportunistic cleanup so the Map can't grow unbounded on a long-lived instance.
function sweep(now: number) {
  if (store.size < 5000) return
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k)
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Returns null if the request is allowed, or a 429 NextResponse if the caller
 * has exceeded `limit` requests within `windowMs` for the given `bucket`.
 */
export function rateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now()
  sweep(now)
  const key = `${bucket}:${clientIp(req)}`
  const existing = store.get(key)

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (existing.count >= limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  existing.count += 1
  return null
}
