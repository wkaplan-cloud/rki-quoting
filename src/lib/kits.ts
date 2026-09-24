import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ElecKit, ElecKitItem } from '@/lib/elec-types'

/**
 * Kits: named bundles of quote lines. Only ever read and written on the
 * service role (RLS on the tables has no policies), so every query here
 * filters by portal_account_id itself.
 */

export interface KitInput {
  name: string
  description?: string | null
  items: {
    description: string
    unit?: string | null
    quantity: number
    cost_unit_rate?: number | null
    markup_percentage?: number | null
    quoted_unit_rate: number
    labour_rate?: number | null
  }[]
}

const KIT_SELECT = 'id, portal_account_id, name, description, created_at, updated_at, items:elec_kit_items(id, kit_id, description, unit, quantity, cost_unit_rate, markup_percentage, quoted_unit_rate, labour_rate, sort_order)'

export async function listKits(portalAccountId: string): Promise<ElecKit[]> {
  const { data, error } = await supabaseAdmin
    .from('elec_kits')
    .select(KIT_SELECT)
    .eq('portal_account_id', portalAccountId)
    .order('name')
  if (error) return []
  return (data ?? []).map(k => ({
    ...(k as unknown as ElecKit),
    items: [...((k as { items?: ElecKitItem[] }).items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

/** Checks a request body; returns the reason it is unusable, or null. */
export function validateKit(body: unknown): string | null {
  const b = body as Partial<KitInput> | null
  if (!b || typeof b.name !== 'string' || !b.name.trim()) return 'Give the kit a name'
  if (!Array.isArray(b.items) || b.items.length === 0) return 'Add at least one line to the kit'
  for (const it of b.items) {
    if (!it || typeof it.description !== 'string' || !it.description.trim()) return 'Every line needs a description'
    if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) return 'Every line needs a quantity above zero'
  }
  return null
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export function kitItemRows(kitId: string, items: KitInput['items']) {
  return items.map((it, i) => ({
    kit_id: kitId,
    description: it.description.trim(),
    unit: it.unit?.trim() || 'nr',
    quantity: Number(it.quantity),
    cost_unit_rate: num(it.cost_unit_rate),
    markup_percentage: num(it.markup_percentage),
    quoted_unit_rate: num(it.quoted_unit_rate) ?? 0,
    labour_rate: num(it.labour_rate),
    sort_order: i,
  }))
}
