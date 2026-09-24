import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/sage-crypto'
import type { ElecDevice, ElecDeviceInput } from '@/lib/elec-types'

/**
 * Device register. Service-role only (RLS has no policies), so every query
 * here filters by portal_account_id itself, and the encrypted password column
 * is never selected into anything that leaves the server.
 */

export const DEVICE_COLS = 'id, portal_account_id, client_id, quote_id, room, category, brand, model, description, serial_number, mac_address, ip_address, firmware, installed_on, warranty_until, username, password_encrypted, notes, created_by_name, created_at, updated_at, client:elec_clients(id, client_name), quote:elec_quotes(id, quote_number, project_name)'

type Row = Omit<ElecDevice, 'has_password' | 'client' | 'quote'> & {
  password_encrypted: string | null
  client?: unknown
  quote?: unknown
}

const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

/** Strips the ciphertext and flattens joins — the only shape a device leaves the server in. */
export function toPublicDevice(row: Row): ElecDevice {
  const { password_encrypted, client, quote, ...rest } = row
  return {
    ...rest,
    has_password: !!password_encrypted,
    client: one<ElecDevice['client']>(client),
    quote: one<ElecDevice['quote']>(quote),
  }
}

const text = (v: unknown, max = 300) => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

/** 001122aabbcc / 00-11-22-AA-BB-CC → 00:11:22:AA:BB:CC. Anything else is kept as typed. */
export function normaliseMac(v: string | null): string | null {
  if (!v) return null
  const hex = v.replace(/[^0-9a-fA-F]/g, '')
  return hex.length === 12 ? hex.toUpperCase().match(/.{2}/g)!.join(':') : v.trim()
}

/**
 * The writable columns from a request body. Only keys present in the body are
 * returned, so a PATCH leaves everything else alone.
 */
export function deviceFields(body: ElecDeviceInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: keyof ElecDeviceInput) => Object.prototype.hasOwnProperty.call(body, k)
  for (const k of ['room', 'category', 'brand', 'model', 'firmware', 'username', 'ip_address'] as const) {
    if (has(k)) out[k] = text(body[k], 120)
  }
  if (has('description'))   out.description   = text(body.description)
  if (has('notes'))         out.notes         = text(body.notes, 2000)
  if (has('serial_number')) out.serial_number = text(body.serial_number, 120)
  if (has('mac_address'))   out.mac_address   = normaliseMac(text(body.mac_address, 60))
  if (has('installed_on'))  out.installed_on  = date(body.installed_on)
  if (has('warranty_until')) out.warranty_until = date(body.warranty_until)
  if (has('password')) {
    const pw = typeof body.password === 'string' ? body.password : null
    out.password_encrypted = pw ? encrypt(pw) : null
  }
  return out
}

/**
 * Checks that the client and project a device is being attached to belong to
 * this account, and fills the client in from the project when only that was
 * given. Returns an error message, or the ids to store.
 */
export async function resolveDeviceLinks(accountId: string, clientId: unknown, quoteId: unknown):
  Promise<{ error: string } | { client_id: string | null; quote_id: string | null }> {
  let client_id = typeof clientId === 'string' && clientId ? clientId : null
  const quote_id = typeof quoteId === 'string' && quoteId ? quoteId : null

  if (quote_id) {
    const { data: quote } = await supabaseAdmin
      .from('elec_quotes').select('id, client_id').eq('id', quote_id).eq('portal_account_id', accountId).maybeSingle()
    if (!quote) return { error: 'Project not found' }
    client_id = client_id ?? quote.client_id ?? null
  }
  if (client_id) {
    const { data: client } = await supabaseAdmin
      .from('elec_clients').select('id').eq('id', client_id).eq('portal_account_id', accountId).maybeSingle()
    if (!client) return { error: 'Client not found' }
  }
  return { client_id, quote_id }
}
