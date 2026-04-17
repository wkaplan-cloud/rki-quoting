import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/sage-crypto'

const LIVE_API_BASE = 'https://accounting.sageone.co.za/api/2.0.0'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const basicToken = Buffer.from(`${email}:${password}`).toString('base64')

    // Do NOT send SAGE_API_KEY to the live URL — the reseller key only works on the sandbox.
    const companyUrl = `${LIVE_API_BASE}/Company/Get`

    const res = await fetch(companyUrl, {
      headers: {
        Authorization: `Basic ${basicToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[sage/connect-basic] Company/Get failed:', res.status, text)
      return NextResponse.json(
        { error: `Sage returned ${res.status}: ${text.slice(0, 300)}` },
        { status: 400 }
      )
    }

    const data = await res.json()
    const companies: { ID: number; Name: string }[] = Array.isArray(data)
      ? data
      : (data.Results ?? [data])

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies found on this Sage account' }, { status: 400 })
    }

    const companyId = String(companies[0].ID)
    const companyName = companies[0].Name

    // Store encrypted credentials — clear any OAuth tokens
    const { error, count } = await supabaseAdmin.from('settings').update({
      sage_username: email,
      sage_password: encrypt(password),
      sage_company_id: companyId,
      sage_access_token: null,
      sage_refresh_token: null,
      sage_token_expires_at: null,
    }, { count: 'exact' }).eq('user_id', user.id)

    if (error) {
      console.error('[sage/connect-basic] DB update failed:', error)
      return NextResponse.json({ error: `Failed to save credentials: ${error.message}` }, { status: 500 })
    }

    if (count === 0) {
      console.error('[sage/connect-basic] No settings row found for user_id:', user.id)
      return NextResponse.json({ error: 'No settings row found — contact support' }, { status: 500 })
    }

    return NextResponse.json({ company_id: companyId, company_name: companyName })
  } catch (e) {
    console.error('[sage/connect-basic] unexpected error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
