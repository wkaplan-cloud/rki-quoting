import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ORG_ID = process.env.CAPITAL_HOTEL_ORG_ID

// GET /api/capital-portal/hotels — public, returns active hotels for the portal
export async function GET() {
  try {
    if (!ORG_ID) return NextResponse.json({ error: 'Portal not configured' }, { status: 503 })

    const { data, error } = await supabaseAdmin
      .from('capital_hotels')
      .select('id, name')
      .eq('org_id', ORG_ID)
      .eq('active', true)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ hotels: data ?? [] })
  } catch (e) {
    return apiError(e)
  }
}
