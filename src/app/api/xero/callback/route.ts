import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const settingsUrl = new URL('/admin', req.url)

  if (error) {
    console.error('[xero/callback] OAuth error:', error, errorDescription)
    settingsUrl.searchParams.set('xero_error', error)
    return NextResponse.redirect(settingsUrl)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('xero_oauth_state')?.value
  cookieStore.delete('xero_oauth_state')

  if (!state || !savedState || state !== savedState) {
    settingsUrl.searchParams.set('xero_error', 'invalid_state')
    return NextResponse.redirect(settingsUrl)
  }

  if (!code) {
    settingsUrl.searchParams.set('xero_error', 'no_code')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.XERO_REDIRECT_URI!,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[xero/callback] token exchange failed:', tokenRes.status, await tokenRes.text())
      settingsUrl.searchParams.set('xero_error', 'token_exchange_failed')
      return NextResponse.redirect(settingsUrl)
    }

    const tokens = await tokenRes.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Fetch connected Xero organisations and auto-pick the first
    const tenantsRes = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    })
    if (!tenantsRes.ok) {
      console.error('[xero/callback] connections fetch failed:', tenantsRes.status, await tenantsRes.text())
      settingsUrl.searchParams.set('xero_error', 'no_tenant')
      return NextResponse.redirect(settingsUrl)
    }
    const tenants = await tenantsRes.json()
    if (!tenants.length) {
      console.error('[xero/callback] no Xero organisations found on this account')
      settingsUrl.searchParams.set('xero_error', 'no_tenant')
      return NextResponse.redirect(settingsUrl)
    }
    const tenantId: string = tenants[0].tenantId
    const tenantName: string = tenants[0].tenantName ?? ''

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', req.url))

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (orgId) {
      await supabaseAdmin.from('settings').update({
        xero_access_token: tokens.access_token,
        xero_refresh_token: tokens.refresh_token ?? null,
        xero_token_expires_at: expiresAt,
        xero_tenant_id: tenantId,
        xero_tenant_name: tenantName,
      }).eq('org_id', orgId)
    }

    settingsUrl.searchParams.set('xero_connected', '1')
    if (tenantName) settingsUrl.searchParams.set('xero_tenant', tenantName)
    return NextResponse.redirect(settingsUrl)
  } catch (e) {
    console.error('[xero/callback] unexpected error:', e)
    settingsUrl.searchParams.set('xero_error', 'unknown')
    return NextResponse.redirect(settingsUrl)
  }
}
