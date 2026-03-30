import { NextRequest, NextResponse } from 'next/server'

// Temporary debug route — tests a single Twinbru /products/ call and returns the raw response
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
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  // Try 3 variations to find what works
  const variants = [
    { page: 1, pageSize: 5, filter: '' },
    { page: 1, pageSize: 5 },
    { page: 1, pageSize: 5, filter: null },
  ]

  const results = []
  for (const body of variants) {
    try {
      const res = await fetch(`${BASE}/products/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* not json */ }
      results.push({
        body_sent: body,
        status: res.status,
        ok: res.ok,
        response_preview: text.slice(0, 500),
        response_json: json ? { totalItemCount: json.totalItemCount, resultCount: json.results?.length ?? json.items?.length } : null,
      })
      if (res.ok) break // stop at first success
    } catch (e) {
      results.push({ body_sent: body, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ results })
}
