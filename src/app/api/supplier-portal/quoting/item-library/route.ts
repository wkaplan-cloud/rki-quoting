import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

interface SyncItem {
  description: string
  unit: string | null
  default_markup_percent: number | null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { items } = await req.json() as { items: SyncItem[] }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ ok: true })

    const rows = items
      .filter(i => i.description?.trim())
      .map(i => ({
        portal_account_id: account.id,
        description: i.description.trim(),
        unit: i.unit,
        default_markup_percent: i.default_markup_percent,
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
