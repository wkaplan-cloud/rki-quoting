import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/sage-crypto'

// OAuth (reseller/sandbox) endpoints
const OAUTH_API_BASE = process.env.SAGE_API_URL ?? 'https://resellers.accounting.sageone.co.za/api/2.0.0'
const OAUTH_TOKEN_URL = 'https://id.sage.com/oauth/token'

// Basic Auth (live) endpoint
const LIVE_API_BASE = 'https://accounting.sageone.co.za/api/2.0.0'

interface OAuthConnection {
  type: 'oauth'
  id: string
  sage_access_token: string
  sage_refresh_token: string | null
  sage_token_expires_at: string | null
  sage_company_id: string
}

interface BasicAuthConnection {
  type: 'basic'
  id: string
  sage_username: string
  sage_password: string // encrypted value from DB
  sage_company_id: string
}

type SageConnection = OAuthConnection | BasicAuthConnection

async function getConnection(): Promise<SageConnection> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('id, sage_access_token, sage_refresh_token, sage_token_expires_at, sage_company_id, sage_username, sage_password')
    .maybeSingle()

  if (!data?.sage_company_id) {
    throw new Error('Sage not connected — connect your Sage account in Settings')
  }

  if (data.sage_username && data.sage_password) {
    return {
      type: 'basic',
      id: data.id,
      sage_username: data.sage_username,
      sage_password: data.sage_password,
      sage_company_id: data.sage_company_id,
    }
  }

  if (data.sage_access_token) {
    return {
      type: 'oauth',
      id: data.id,
      sage_access_token: data.sage_access_token,
      sage_refresh_token: data.sage_refresh_token ?? null,
      sage_token_expires_at: data.sage_token_expires_at ?? null,
      sage_company_id: data.sage_company_id,
    }
  }

  throw new Error('Sage not connected — connect your Sage account in Settings')
}

async function refreshOAuthToken(conn: OAuthConnection): Promise<string> {
  if (!conn.sage_refresh_token) {
    throw new Error('No refresh token — please reconnect Sage in Settings')
  }

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

/** Returns { authHeader, apiBase, companyId } ready for API calls. */
async function getAuth(): Promise<{ authHeader: string; apiBase: string; companyId: string }> {
  const conn = await getConnection()

  if (conn.type === 'basic') {
    const password = decrypt(conn.sage_password)
    const basicToken = Buffer.from(`${conn.sage_username}:${password}`).toString('base64')
    return {
      authHeader: `Basic ${basicToken}`,
      apiBase: LIVE_API_BASE,
      companyId: conn.sage_company_id,
    }
  }

  // OAuth — refresh if expiring soon
  const expiresAt = conn.sage_token_expires_at ? new Date(conn.sage_token_expires_at) : null
  const isExpiring = expiresAt ? expiresAt.getTime() - 60_000 < Date.now() : false
  const token = isExpiring ? await refreshOAuthToken(conn) : conn.sage_access_token

  return {
    authHeader: `Bearer ${token}`,
    apiBase: OAUTH_API_BASE,
    companyId: conn.sage_company_id,
  }
}

function buildUrl(apiBase: string, companyId: string, path: string, isBasicAuth: boolean): string {
  // Do not use URLSearchParams for apikey — Sage requires literal curly braces.
  // Do NOT send the reseller API key to the live URL — it only works on the sandbox.
  const apiKey = isBasicAuth ? null : process.env.SAGE_API_KEY
  const base = `${apiBase}${path}?CompanyId=${companyId}`
  return apiKey ? `${base}&apikey=${apiKey}` : base
}

export async function sageGet(path: string) {
  const { authHeader, apiBase, companyId } = await getAuth()
  const isBasicAuth = authHeader.startsWith('Basic ')
  const res = await fetch(buildUrl(apiBase, companyId, path, isBasicAuth), {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sagePost(path: string, body: object) {
  const { authHeader, apiBase, companyId } = await getAuth()
  const isBasicAuth = authHeader.startsWith('Basic ')
  const res = await fetch(buildUrl(apiBase, companyId, path, isBasicAuth), {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}
