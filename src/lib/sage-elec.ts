import { supabaseAdmin } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/sage-crypto'

const LIVE_API_BASE = 'https://accounting.sageone.co.za/api/2.0.0'
const OAUTH_API_BASE = process.env.SAGE_API_URL ?? 'https://resellers.accounting.sageone.co.za/api/2.0.0'
const OAUTH_TOKEN_URL = 'https://id.sage.com/oauth/token'

export interface ElecSageStatus {
  connected: boolean
  companyId: string | null
  username: string | null
}

export async function getElecPortalAccount(userId: string) {
  const { data } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email')
    .eq('auth_user_id', userId)
    .single()
  return data
}

async function getConnection(portalAccountId: string) {
  const { data } = await supabaseAdmin
    .from('elec_settings')
    .select('id, sage_access_token, sage_refresh_token, sage_token_expires_at, sage_company_id, sage_username, sage_password')
    .eq('portal_account_id', portalAccountId)
    .maybeSingle()

  if (!data?.sage_company_id) {
    throw new Error('Sage not connected — connect your Sage account in Settings')
  }

  if (data.sage_username && data.sage_password) {
    return {
      type: 'basic' as const,
      settingsId: data.id,
      sage_username: data.sage_username,
      sage_password: data.sage_password,
      sage_company_id: data.sage_company_id,
    }
  }

  if (data.sage_access_token) {
    return {
      type: 'oauth' as const,
      settingsId: data.id,
      sage_access_token: data.sage_access_token,
      sage_refresh_token: data.sage_refresh_token as string | null,
      sage_token_expires_at: data.sage_token_expires_at as string | null,
      sage_company_id: data.sage_company_id,
    }
  }

  throw new Error('Sage not connected — connect your Sage account in Settings')
}

async function refreshOAuthToken(conn: { type: 'oauth'; settingsId: string; sage_refresh_token: string | null; sage_company_id: string }): Promise<string> {
  if (!conn.sage_refresh_token) throw new Error('No refresh token — please reconnect Sage in Settings')

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SAGE_CLIENT_ID!,
      client_secret: process.env.SAGE_CLIENT_SECRET!,
      refresh_token: conn.sage_refresh_token,
    }),
  })

  if (!res.ok) throw new Error(`Failed to refresh Sage token (${res.status}) — please reconnect Sage in Settings`)

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabaseAdmin.from('elec_settings').update({
    sage_access_token: tokens.access_token,
    sage_refresh_token: tokens.refresh_token ?? conn.sage_refresh_token,
    sage_token_expires_at: expiresAt,
  }).eq('id', conn.settingsId)

  return tokens.access_token as string
}

async function getAuth(portalAccountId: string): Promise<{ authHeader: string; apiBase: string; companyId: string }> {
  const conn = await getConnection(portalAccountId)

  if (conn.type === 'basic') {
    const password = decrypt(conn.sage_password)
    const basicToken = Buffer.from(`${conn.sage_username}:${password}`).toString('base64')
    return { authHeader: `Basic ${basicToken}`, apiBase: LIVE_API_BASE, companyId: conn.sage_company_id }
  }

  const expiresAt = conn.sage_token_expires_at ? new Date(conn.sage_token_expires_at) : null
  const isExpiring = expiresAt ? expiresAt.getTime() - 60_000 < Date.now() : false
  const token = isExpiring ? await refreshOAuthToken(conn) : conn.sage_access_token

  return { authHeader: `Bearer ${token}`, apiBase: OAUTH_API_BASE, companyId: conn.sage_company_id }
}

function buildUrl(apiBase: string, companyId: string, path: string, extra?: Record<string, string | number>): string {
  const apiKey = process.env.SAGE_API_KEY
  let base = `${apiBase}${path}?CompanyId=${companyId}`
  if (apiKey) base += `&apikey=${apiKey}`
  if (extra) {
    for (const [k, v] of Object.entries(extra)) base += `&${k}=${encodeURIComponent(String(v))}`
  }
  return base
}

export async function elecSageGet(portalAccountId: string, path: string, extra?: Record<string, string | number>) {
  const { authHeader, apiBase, companyId } = await getAuth(portalAccountId)
  const res = await fetch(buildUrl(apiBase, companyId, path, extra), {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function elecSageGetAll<T = Record<string, unknown>>(portalAccountId: string, path: string): Promise<T[]> {
  const PAGE_SIZE = 100
  const all: T[] = []
  let skip = 0
  while (true) {
    const data = await elecSageGet(portalAccountId, path, { '$top': PAGE_SIZE, '$skip': skip })
    const page: T[] = Array.isArray(data) ? data : (data.Results ?? [])
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    const total: number = data.TotalResults ?? data.totalResults ?? Infinity
    skip += PAGE_SIZE
    if (skip >= total) break
  }
  return all
}

export async function elecSagePost(portalAccountId: string, path: string, body: object) {
  const { authHeader, apiBase, companyId } = await getAuth(portalAccountId)
  const res = await fetch(buildUrl(apiBase, companyId, path), {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getElecSageStatus(portalAccountId: string): Promise<ElecSageStatus> {
  const { data } = await supabaseAdmin
    .from('elec_settings')
    .select('sage_company_id, sage_username')
    .eq('portal_account_id', portalAccountId)
    .maybeSingle()

  return {
    connected: !!(data?.sage_company_id),
    companyId: data?.sage_company_id ?? null,
    username: data?.sage_username ?? null,
  }
}
