import { NextRequest, NextResponse } from 'next/server'

// This endpoint is superseded by /api/sourcing/respond/[token]/price
// Kept as a stub to avoid 404s from any cached links
export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/sourcing/respond/[token]/price instead' }, { status: 410 })
}
