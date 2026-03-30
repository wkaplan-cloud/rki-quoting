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

  // Test 1: GET single product by ID
  const productId = req.nextUrl.searchParams.get('productId') ?? '35250'
  const getRes = await fetch(`${BASE}/products/${productId}`, { headers })
  const getText = await getRes.text()
  let getJson = null
  try { getJson = JSON.parse(getText) } catch { /* not json */ }

  // Test 2: GET stock for that product (quantity=10 as a test)
  const stockRes = await fetch(`${BASE}/stock/${productId}?quantity=10`, { headers })
  const stockText = await stockRes.text()
  let stockJson = null
  try { stockJson = JSON.parse(stockText) } catch { /* not json */ }

  return NextResponse.json({
    get:   { status: getRes.status,   ok: getRes.ok,   raw: getJson   ?? getText.slice(0, 500) },
    stock: { status: stockRes.status, ok: stockRes.ok, raw: stockJson ?? stockText.slice(0, 500) },
  })
}
