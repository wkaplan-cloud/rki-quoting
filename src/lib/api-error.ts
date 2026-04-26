import { NextResponse } from 'next/server'

export function apiError(e: unknown, status = 500): NextResponse {
  const message = e instanceof Error ? e.message : 'An unexpected error occurred'
  console.error('[api]', e)
  return NextResponse.json({ error: message }, { status })
}
