import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

interface SyncItem {
  description: string
  unit: string | null
  item_type: string
  default_unit_rate: number | null
  default_cost_rate: number | null
  default_markup_percent: number | null
  default_labour_rate: number | null
  default_material_rate: number | null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { items } = await req.json() as { items: SyncItem[] }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ ok: true })

    const rows = items
      .filter(i => i.description?.trim())
      .map(i => ({
        portal_account_id: account.id,
        description: i.description.trim(),
        unit: i.unit,
        item_type: i.item_type ?? 'both',
        default_unit_rate: i.default_unit_rate,
        default_cost_rate: i.default_cost_rate,
        default_markup_percent: i.default_markup_percent,
        default_labour_rate: i.default_labour_rate,
        default_material_rate: i.default_material_rate,
        updated_at: new Date().toISOString(),
      }))

    if (rows.length > 0) {
      await supabaseAdmin
        .from('elec_item_library')
        .upsert(rows, { onConflict: 'portal_account_id,description' })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
