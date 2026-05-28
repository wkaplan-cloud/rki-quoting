import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/sage-crypto'
import { getElecPortalAccount } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

const LIVE_API_BASE = 'https://accounting.sageone.co.za/api/2.0.0'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, password } = await req.json() as { email: string; password: string }
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    const basicToken = Buffer.from(`${email}:${password}`).toString('base64')
    const apiKey = process.env.SAGE_API_KEY
    const companyUrl = apiKey
      ? `${LIVE_API_BASE}/Company/Get?apikey=${apiKey}`
      : `${LIVE_API_BASE}/Company/Get`

    const res = await fetch(companyUrl, {
      headers: { Authorization: `Basic ${basicToken}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Sage returned ${res.status}: ${text.slice(0, 300)}` }, { status: 400 })
    }

    const data = await res.json()
    const companies: { ID: number; Name: string }[] = Array.isArray(data) ? data : (data.Results ?? [data])
    if (companies.length === 0) return NextResponse.json({ error: 'No companies found on this Sage account' }, { status: 400 })

    const companyId = String(companies[0].ID)
    const companyName = companies[0].Name

    await supabaseAdmin.from('elec_settings').update({
      sage_username: email,
      sage_password: encrypt(password),
      sage_company_id: companyId,
      sage_access_token: null,
      sage_refresh_token: null,
      sage_token_expires_at: null,
    }).eq('portal_account_id', account.id)

    return NextResponse.json({ company_id: companyId, company_name: companyName })
  } catch (e) {
    return apiError(e)
  }
}
