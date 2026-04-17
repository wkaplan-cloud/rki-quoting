import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/sage-crypto'

const OAUTH_API_BASE = process.env.SAGE_API_URL ?? 'https://resellers.accounting.sageone.co.za/api/2.0.0'
const LIVE_API_BASE = 'https://accounting.sageone.co.za/api/2.0.0'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: settings } = await supabase
      .from('settings')
      .select('sage_access_token, sage_username, sage_password')
      .eq('user_id', user.id)
      .maybeSingle()

    let authHeader: string
    let apiBase: string

    if (settings?.sage_username && settings?.sage_password) {
      const password = decrypt(settings.sage_password)
      const basicToken = Buffer.from(`${settings.sage_username}:${password}`).toString('base64')
      authHeader = `Basic ${basicToken}`
      apiBase = LIVE_API_BASE
    } else if (settings?.sage_access_token) {
      authHeader = `Bearer ${settings.sage_access_token}`
      apiBase = OAUTH_API_BASE
    } else {
      return NextResponse.json({ error: 'Sage not connected' }, { status: 400 })
    }

    const apiKey = process.env.SAGE_API_KEY
    const url = apiKey
      ? `${apiBase}/Company/Get?apikey=${apiKey}`
      : `${apiBase}/Company/Get`

    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[sage/fetch-company-id]', res.status, text)
      return NextResponse.json({ error: `Sage returned ${res.status}: ${text.slice(0, 200)}` }, { status: 400 })
    }

    const data = await res.json()
    const companies: { ID: number; Name: string }[] = Array.isArray(data)
      ? data
      : (data.Results ?? [data])

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies found on this Sage account' }, { status: 400 })
    }

    const companyId = String(companies[0].ID)

    await supabase.from('settings').update({ sage_company_id: companyId }).eq('user_id', user.id)

    return NextResponse.json({ company_id: companyId, company_name: companies[0].Name })
  } catch (e) {
    console.error('[sage/fetch-company-id]', e)
    return NextResponse.json({ error: 'Failed to fetch company ID from Sage' }, { status: 500 })
  }
}
