import { NextRequest, NextResponse } from 'next/server'

const BASE      = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const STOCK_KEY = process.env.TWINBRU_STOCK_KEY ?? ''
const BEARER    = process.env.TWINBRU_BEARER_TOKEN ?? ''

export interface StockEntry {
  stockQuantity: number
  stockDate: string
  isMaxLeadTime: boolean
}

export interface StockInfo {
  // Stock available in SA today
  localQty: number | null
  // Stock in transit from BE — soonest non-max entry after today
  transitQty: number | null
  transitDate: string | null
  // Worst-case lead time
  maxLeadTimeDate: string | null
  // Convenience: weeks until soonest available stock (0 = in stock now)
  weeksUntilAvailable: number | null
}

function weeksUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
}

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  const url = `${BASE}/stock/calendar?includeMaxLeadTime=true&filter=productId.eq.${productId}`
  const res = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': STOCK_KEY,
      'Authorization': `Bearer ${BEARER}`,
      'Api-Version': 'v1',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 },
  })

  if (!res.ok) return NextResponse.json({ localQty: null, transitQty: null, transitDate: null, maxLeadTimeDate: null, weeksUntilAvailable: null })

  const data = await res.json()
  const item = data?.results?.[0]?.item
  const stock: StockEntry[] = Array.isArray(item?.stock) ? item.stock : []

  const today = new Date().toISOString().slice(0, 10)

  // In SA today
  const localEntry = stock.find(s => !s.isMaxLeadTime && s.stockDate <= today)
  // In transit from BE — soonest future non-max entry
  const transitEntry = stock
    .filter(s => !s.isMaxLeadTime && s.stockDate > today)
    .sort((a, b) => a.stockDate.localeCompare(b.stockDate))[0] ?? null
  // Max lead time entry
  const maxEntry = stock.find(s => s.isMaxLeadTime) ?? null

  const localQty  = localEntry   ? localEntry.stockQuantity   : null
  const transitQty  = transitEntry ? transitEntry.stockQuantity : null
  const transitDate = transitEntry ? transitEntry.stockDate     : null
  const maxLeadTimeDate = maxEntry ? maxEntry.stockDate         : null

  let weeksUntilAvailable: number | null = null
  if (localQty != null && localQty > 0) {
    weeksUntilAvailable = 0
  } else if (transitDate) {
    weeksUntilAvailable = Math.max(0, weeksUntil(transitDate))
  } else if (maxLeadTimeDate) {
    weeksUntilAvailable = Math.max(0, weeksUntil(maxLeadTimeDate))
  }

  const info: StockInfo = { localQty, transitQty, transitDate, maxLeadTimeDate, weeksUntilAvailable }
  return NextResponse.json(info)
}
