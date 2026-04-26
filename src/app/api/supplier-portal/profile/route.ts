import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, company_name, phone, address, categories, description, website, logo_url')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      company_name?: string
      phone?: string
      address?: string
      categories?: string[]
      description?: string
      website?: string
    }

    const { data, error } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({
        company_name: body.company_name?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        categories: body.categories ?? null,
        description: body.description?.trim() || null,
        website: body.website?.trim() || null,
      })
      .eq('auth_user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
