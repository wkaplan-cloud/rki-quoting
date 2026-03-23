import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'quotinghub.co.za'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const base = `${protocol}://${host}`

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${base}/settings?sage=error`)
  }

  const redirectUri = `${base}/api/sage/callback`

  const res = await fetch('https://oauth.accounting.sage.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.SAGE_CLIENT_ID!,
      client_secret: process.env.SAGE_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    return NextResponse.redirect(`${base}/settings?sage=error`)
  }

  const data = await res.json()

  const supabase = await createClient()
  await supabase.from('settings').update({
    sage_access_token: data.access_token,
    sage_refresh_token: data.refresh_token,
    sage_token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  })

  return NextResponse.redirect(`${base}/settings?sage=connected`)
}
