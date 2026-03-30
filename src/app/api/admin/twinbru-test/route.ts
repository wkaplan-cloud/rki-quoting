import { NextRequest, NextResponse } from 'next/server'

// Debug route — fetches a single product by ID and returns all raw fields
// Usage: GET /api/admin/twinbru-test?productId=35250
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const BASE    = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
  const SUB_KEY = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
  const BEARER  = process.env.TWINBRU_BEARER_TOKEN ?? ''

  const headers = {
    'Ocp-Apim-Subscription-Key': SUB_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Api-Version': 'v1',
    'Accept': 'application/json',
  }

  const productId = req.nextUrl.searchParams.get('productId') ?? '35250'

  const res = await fetch(`${BASE}/products/${productId}`, { headers })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }

  return NextResponse.json({ status: res.status, ok: res.ok, raw: json ?? text })
}
