import { createClient } from '@/lib/supabase/server'

const SA_API_BASE = 'https://resellers.accounting.sageone.co.za/api/2.0.0'

interface SageCredentials {
  sage_api_key: string
  sage_username: string
  sage_password: string
  sage_company_id: string
}

function authHeader(username: string, password: string) {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

async function getCredentials(): Promise<SageCredentials> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('sage_api_key, sage_username, sage_password, sage_company_id')
    .maybeSingle()

  if (!data?.sage_api_key || !data?.sage_username || !data?.sage_password || !data?.sage_company_id) {
    throw new Error('Sage not configured — add your Sage credentials in Settings')
  }
  return data as SageCredentials
}

function buildUrl(creds: SageCredentials, path: string) {
  return `${SA_API_BASE}${path}?apikey=${creds.sage_api_key}&CompanyId=${creds.sage_company_id}`
}

export async function sageGet(path: string) {
  const creds = await getCredentials()
  const res = await fetch(buildUrl(creds, path), {
    headers: {
      Authorization: authHeader(creds.sage_username, creds.sage_password),
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sagePost(path: string, body: object) {
  const creds = await getCredentials()
  const res = await fetch(buildUrl(creds, path), {
    method: 'POST',
    headers: {
      Authorization: authHeader(creds.sage_username, creds.sage_password),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Sage API error ${res.status}: ${await res.text()}`)
  return res.json()
}
