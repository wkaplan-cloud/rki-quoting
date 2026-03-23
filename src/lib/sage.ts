import { createClient } from '@/lib/supabase/server'

const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token'
export const SAGE_API_BASE = 'https://api.accounting.sage.com/v3.1'
export const SAGE_AUTH_URL = 'https://www.sageone.com/oauth2/auth/central'

interface SageTokens {
  sage_access_token: string | null
  sage_refresh_token: string | null
  sage_token_expires_at: string | null
}

async function refreshAccessToken(tokens: SageTokens): Promise<string> {
  if (!tokens.sage_refresh_token) throw new Error('No refresh token — please reconnect Sage')

  const res = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.sage_refresh_token,
      client_id: process.env.SAGE_CLIENT_ID!,
      client_secret: process.env.SAGE_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error('Failed to refresh Sage token — please reconnect in Settings')
  const data = await res.json()

  const supabase = await createClient()
  await supabase.from('settings').update({
    sage_access_token: data.access_token,
    sage_refresh_token: data.refresh_token ?? tokens.sage_refresh_token,
    sage_token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  })

  return data.access_token as string
}

export async function getSageToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('sage_access_token, sage_refresh_token, sage_token_expires_at')
    .maybeSingle()

  if (!data?.sage_access_token) throw new Error('Sage not connected — go to Settings to connect')

  // Return existing token if not expiring within 5 minutes
  if (data.sage_token_expires_at) {
    const expiresAt = new Date(data.sage_token_expires_at).getTime()
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return data.sage_access_token
    }
  }

  return refreshAccessToken(data as SageTokens)
}

export async function sageGet(path: string) {
  const token = await getSageToken()
  const res = await fetch(`${SAGE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}`)
  return res.json()
}

export async function sagePost(path: string, body: object) {
  const token = await getSageToken()
  const res = await fetch(`${SAGE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sage API error ${res.status}: ${err}`)
  }
  return res.json()
}
