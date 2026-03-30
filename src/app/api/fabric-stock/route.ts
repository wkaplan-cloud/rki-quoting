import { NextRequest, NextResponse } from 'next/server'

const BASE      = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const STOCK_KEY = process.env.TWINBRU_STOCK_KEY ?? ''
const BEARER    = process.env.TWINBRU_BEARER_TOKEN ?? ''

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  const quantity  = req.nextUrl.searchParams.get('quantity') ?? '1'
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  const res = await fetch(`${BASE}/stock/${productId}?quantity=${quantity}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': STOCK_KEY,
      'Authorization': `Bearer ${BEARER}`,
      'Api-Version': 'v1',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 }, // cache for 1 hour
  })

  if (!res.ok) return NextResponse.json({ available: null }, { status: 200 })

  const data = await res.json()
  const item = data?.results?.[0]?.item
  if (!item) return NextResponse.json({ available: null })

  const stockDate = item.stockDate as string | null
  const today = new Date().toISOString().slice(0, 10)
  const inStock = stockDate ? stockDate <= today : false

  return NextResponse.json({
    stockDate,
    inStock,
    stockQuantity: item.stockQuantity ?? null,
    isMaxLeadTime: item.isMaxLeadTime ?? false,
  })
}
