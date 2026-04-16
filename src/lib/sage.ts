import { createClient } from '@/lib/supabase/server'

const SA_API_BASE = process.env.SAGE_API_URL ?? 'https://resellers.accounting.sageone.co.za/api/2.0.0'
const SAGE_TOKEN_URL = 'https://id.sage.com/oauth/token'

interface SageConnection {
  id: string
  sage_access_token: string
  sage_refresh_token: string | null
  sage_token_expires_at: string | null
  sage_company_id: string
}

async function getConnection(): Promise<SageConnection> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('id, sage_access_token, sage_refresh_token, sage_token_expires_at, sage_company_id')
    .maybeSingle()

  if (!data?.sage_access_token || !data?.sage_company_id) {
    throw new Error('Sage not connected — connect your Sage account in Settings')
  }
  return data as SageConnection
}

async function refreshAccessToken(conn: SageConnection): Promise<string> {
  if (!conn.sage_refresh_token) {
    throw new Error('No refresh token — please reconnect Sage in Settings')
  }

  const res = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SAGE_CLIENT_ID!,
      client_secret: process.env.SAGE_CLIENT_SECRET!,
      refresh_token: conn.sage_refresh_token,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to refresh Sage token (${res.status}) — please reconnect Sage in Settings`)
  }

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const supabase = await createClient()
  await supabase.from('settings').update({
    sage_access_token: tokens.access_token,
    sage_refresh_token: tokens.refresh_token ?? conn.sage_refresh_token,
    sage_token_expires_at: expiresAt,
  }).eq('id', conn.id)

  return tokens.access_token as string
}

async function getValidToken(): Promise<{ token: string; companyId: string }> {
  const conn = await getConnection()

  const expiresAt = conn.sage_token_expires_at ? new Date(conn.sage_token_expires_at) : null
  const isExpiredOrExpiringSoon = expiresAt ? expiresAt.getTime() - 60_000 < Date.now() : false

  const token = isExpiredOrExpiringSoon
    ? await refreshAccessToken(conn)
    : conn.sage_access_token

  return { token, companyId: conn.sage_company_id }
}

function buildUrl(companyId: string, path: string): string {
  // Build URL manually — do not use URLSearchParams for apikey because
  // Sage requires the literal curly braces e.g. {key} not %7Bkey%7D
  const apiKey = process.env.SAGE_API_KEY
  const base = `${SA_API_BASE}${path}?CompanyId=${companyId}`
  return apiKey ? `${base}&apikey=${apiKey}` : base
}

export async function sageGet(path: string) {
  const { token, companyId } = await getValidToken()
  const res = await fetch(buildUrl(companyId, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sagePost(path: string, body: object) {
  const { token, companyId } = await getValidToken()
  const res = await fetch(buildUrl(companyId, path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}
