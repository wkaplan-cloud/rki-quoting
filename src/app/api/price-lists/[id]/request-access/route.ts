import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { error } = await supabase.from('price_list_access').insert({
    org_id: orgId,
    price_list_id: id,
    status: 'pending',
  })

  if (error && error.code === '23505') {
    return NextResponse.json({ error: 'Already requested' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify platform admin of new request
  try {
    const [{ data: org }, { data: priceList }] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).single(),
      supabaseAdmin.from('price_lists').select('name, supplier_name').eq('id', id).single(),
    ])
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'QuotingHub <no-reply@quotinghub.co.za>',
      to: 'hello@quotinghub.co.za',
      subject: `New price list access request — ${priceList?.name ?? id}`,
      text: `${org?.name ?? orgId} has requested access to the ${priceList?.name ?? id} price list (${priceList?.supplier_name ?? ''}).\n\nReview and approve at: https://quotinghub.co.za/platform/price-lists`,
    })
  } catch { /* non-critical — don't fail the request */ }

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
