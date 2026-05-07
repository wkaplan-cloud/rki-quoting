import { createClient } from '@/lib/supabase/server'

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'

interface XeroConnection {
  id: string
  xero_access_token: string
  xero_refresh_token: string | null
  xero_token_expires_at: string | null
  xero_tenant_id: string
}

async function getConnection(): Promise<XeroConnection> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('id, xero_access_token, xero_refresh_token, xero_token_expires_at, xero_tenant_id')
    .maybeSingle()

  if (!data?.xero_access_token || !data?.xero_tenant_id) {
    throw new Error('Xero not connected — connect your Xero account in Settings')
  }

  return {
    id: data.id,
    xero_access_token: data.xero_access_token,
    xero_refresh_token: data.xero_refresh_token ?? null,
    xero_token_expires_at: data.xero_token_expires_at ?? null,
    xero_tenant_id: data.xero_tenant_id,
  }
}

async function refreshToken(conn: XeroConnection): Promise<string> {
  if (!conn.xero_refresh_token) {
    throw new Error('No refresh token — please reconnect Xero in Settings')
  }

  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.xero_refresh_token,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to refresh Xero token (${res.status}) — please reconnect Xero in Settings`)
  }

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const supabase = await createClient()
  await supabase.from('settings').update({
    xero_access_token: tokens.access_token,
    xero_refresh_token: tokens.refresh_token ?? conn.xero_refresh_token,
    xero_token_expires_at: expiresAt,
  }).eq('id', conn.id)

  return tokens.access_token as string
}

async function getAuth(): Promise<{ token: string; tenantId: string }> {
  const conn = await getConnection()
  const expiresAt = conn.xero_token_expires_at ? new Date(conn.xero_token_expires_at) : null
  const isExpiring = expiresAt ? expiresAt.getTime() - 60_000 < Date.now() : false
  const token = isExpiring ? await refreshToken(conn) : conn.xero_access_token
  return { token, tenantId: conn.xero_tenant_id }
}

export async function xeroGet(path: string) {
  const { token, tenantId } = await getAuth()
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Xero API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function xeroPost(path: string, body: object) {
  const { token, tenantId } = await getAuth()
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Xero API error ${res.status}: ${await res.text()}`)
  return res.json()
}
