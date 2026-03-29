import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isPlatformAdmin(email: string | undefined) {
  return !!(email && process.env.PLATFORM_ADMIN_EMAIL && email.toLowerCase() === process.env.PLATFORM_ADMIN_EMAIL.toLowerCase())
}

// POST — create a new price list (metadata only, no items)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdmin(user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, supplier_name, is_global } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('price_lists')
    .insert({ name, supplier_name: supplier_name ?? 'Home Fabrics', item_count: 0, is_global: is_global ?? false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// DELETE — remove a price list (cascades to items)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdmin(user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('price_lists').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
