import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { apiKey, username, password } = await req.json()
    if (!apiKey || !username || !password) {
      return NextResponse.json({ error: 'apiKey, username and password are required' }, { status: 400 })
    }

    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
    const url = `https://resellers.accounting.sageone.co.za/api/2.0.0/Company/Get?apikey=${encodeURIComponent(apiKey)}`

    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Sage returned ${res.status}: ${text.slice(0, 200)}` }, { status: 400 })
    }

    const data = await res.json()
    // Sage One SA returns an array or { Results: [...] }
    const companies: { ID: number; Name: string }[] = Array.isArray(data) ? data : (data.Results ?? [data])

    return NextResponse.json(companies.map(c => ({ id: String(c.ID), name: c.Name })))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
