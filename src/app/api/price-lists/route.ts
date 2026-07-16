import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

function isPlatformAdmin(email: string | undefined) {
  return !!(email && process.env.PLATFORM_ADMIN_EMAIL && email.toLowerCase() === process.env.PLATFORM_ADMIN_EMAIL.toLowerCase())
}

async function getAdminOrgId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data?.role === 'admin' ? data.org_id : null
}

// POST — create a new price list (metadata only, no items)
// Platform admin creates platform lists (org_id null, optionally global).
// Org admins create lists owned by their own org.
export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, supplier_name, is_global } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  if (isPlatformAdmin(user.email)) {
    const { data, error } = await supabaseAdmin
      .from('price_lists')
      .insert({ name, supplier_name: supplier_name ?? 'Home Fabrics', item_count: 0, is_global: is_global ?? false, created_by: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  const orgId = await getAdminOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Only studio admins can create price lists' }, { status: 403 })

  const { data, error } = await supabase
    .from('price_lists')
    .insert({ name, supplier_name: supplier_name ?? '', item_count: 0, is_global: false, org_id: orgId, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-link the org's supplier of the same name (creating it if needed) so
  // line items get live fabric search for this list without extra setup
  let supplier: 'linked' | 'created' | null = null
  const supName = (supplier_name ?? '').trim()
  if (supName) {
    const { data: matches } = await supabase
      .from('suppliers')
      .select('id, is_platform')
      .ilike('supplier_name', supName)
      .limit(5)
    const own = (matches ?? []).find(s => !s.is_platform)
    if (own) {
      const { error: linkError } = await supabase.from('suppliers').update({ price_list_id: data.id }).eq('id', own.id)
      if (!linkError) supplier = 'linked'
    } else {
      const titleCased = supName.replace(/\b\w/g, (c: string) => c.toUpperCase())
      const { error: createError } = await supabase
        .from('suppliers')
        .insert({ supplier_name: titleCased, org_id: orgId, user_id: user.id, price_list_id: data.id })
      if (!createError) supplier = 'created'
    }
  }

  return NextResponse.json({ id: data.id, supplier })
  } catch (e) {
    return apiError(e)
  }
}

// PATCH — rename a price list / change its supplier name
export async function PATCH(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, supplier_name } = await req.json()
  if (!id || (!name && supplier_name === undefined)) return NextResponse.json({ error: 'id and name or supplier_name required' }, { status: 400 })

  const updates: Record<string, string> = {}
  if (name) updates.name = name
  if (supplier_name !== undefined) updates.supplier_name = supplier_name

  if (isPlatformAdmin(user.email)) {
    const { error } = await supabaseAdmin.from('price_lists').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const orgId = await getAdminOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Only studio admins can edit price lists' }, { status: 403 })

  // RLS restricts the update to this org's own lists
  const { data, error } = await supabase.from('price_lists').update(updates).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE — remove a price list (cascades to items)
export async function DELETE(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (isPlatformAdmin(user.email)) {
    const { error } = await supabaseAdmin.from('price_lists').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabaseAdmin.from('suppliers').update({ price_list_id: null }).eq('price_list_id', id)
    return NextResponse.json({ ok: true })
  }

  const orgId = await getAdminOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Only studio admins can delete price lists' }, { status: 403 })

  // RLS restricts the delete to this org's own lists (global/platform lists are untouchable)
  const { data, error } = await supabase.from('price_lists').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Unlink any of the org's suppliers that pointed at this list
  await supabase.from('suppliers').update({ price_list_id: null }).eq('price_list_id', id)
  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
