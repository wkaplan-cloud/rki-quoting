import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const SA_API_BASE = 'https://resellers.accounting.sageone.co.za/api/2.0.0'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const settingsUrl = new URL('/admin', req.url)

  if (error) {
    console.error('[sage/callback] OAuth error:', error, errorDescription)
    settingsUrl.searchParams.set('sage_error', error)
    return NextResponse.redirect(settingsUrl)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState = cookieStore.get('sage_oauth_state')?.value
  cookieStore.delete('sage_oauth_state')

  if (!state || !savedState || state !== savedState) {
    settingsUrl.searchParams.set('sage_error', 'invalid_state')
    return NextResponse.redirect(settingsUrl)
  }

  if (!code) {
    settingsUrl.searchParams.set('sage_error', 'no_code')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://id.sage.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SAGE_CLIENT_ID!,
        client_secret: process.env.SAGE_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.SAGE_REDIRECT_URI!,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[sage/callback] token exchange failed:', tokenRes.status, text)
      settingsUrl.searchParams.set('sage_error', 'token_exchange_failed')
      return NextResponse.redirect(settingsUrl)
    }

    const tokens = await tokenRes.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Auto-fetch the company ID using the new access token
    let companyId: string | null = null
    try {
      const apiKey = process.env.SAGE_API_KEY
      const companyUrl = apiKey
        ? `${SA_API_BASE}/Company/Get?apikey=${apiKey}`
        : `${SA_API_BASE}/Company/Get`

      const companyRes = await fetch(companyUrl, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })

      if (companyRes.ok) {
        const data = await companyRes.json()
        const companies: { ID: number; Name: string }[] = Array.isArray(data)
          ? data
          : (data.Results ?? [data])
        if (companies.length > 0) companyId = String(companies[0].ID)
      } else {
        console.warn('[sage/callback] Company/Get failed:', await companyRes.text())
      }
    } catch (e) {
      console.warn('[sage/callback] Could not auto-fetch company ID:', e)
    }

    // Persist tokens (and clear old Basic Auth fields)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', req.url))

    await supabase.from('settings').update({
      sage_access_token: tokens.access_token,
      sage_refresh_token: tokens.refresh_token ?? null,
      sage_token_expires_at: expiresAt,
      ...(companyId ? { sage_company_id: companyId } : {}),
      // Clear old Basic Auth credentials
      sage_api_key: null,
      sage_username: null,
      sage_password: null,
    }).eq('user_id', user.id)

    settingsUrl.searchParams.set('sage_connected', '1')
    return NextResponse.redirect(settingsUrl)
  } catch (e) {
    console.error('[sage/callback] unexpected error:', e)
    settingsUrl.searchParams.set('sage_error', 'unknown')
    return NextResponse.redirect(settingsUrl)
  }
}
