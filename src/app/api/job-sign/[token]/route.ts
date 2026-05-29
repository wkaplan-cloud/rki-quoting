import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, work_found, work_done, resolution, client_signature_url, portal_account_id')
      .eq('share_token', token)
      .maybeSingle()

    if (!card) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('company_name, logo_url')
      .eq('id', card.portal_account_id)
      .maybeSingle()

    return NextResponse.json({
      jobNumber: card.job_number,
      title: card.title,
      workFound: card.work_found,
      workDone: card.work_done,
      resolution: card.resolution,
      alreadySigned: !!card.client_signature_url,
      companyName: account?.company_name ?? '',
      logoUrl: account?.logo_url ?? null,
    })
  } catch (e) { return apiError(e) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const { signature, signerName } = await req.json() as { signature: string; signerName?: string }

    if (!signature?.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 })
    }

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id, portal_account_id, client_signature_url')
      .eq('share_token', token)
      .maybeSingle()

    if (!card) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    if (card.client_signature_url) return NextResponse.json({ error: 'Already signed' }, { status: 409 })

    // Decode base64 data URL and upload to storage
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `${card.portal_account_id}/${card.id}/client-signature-${Date.now()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('job-card-photos')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('job-card-photos')
      .getPublicUrl(path)

    await supabaseAdmin
      .from('elec_job_cards')
      .update({
        client_signature_url: publicUrl,
        client_name: signerName ?? null,
        share_token: null,
      })
      .eq('id', card.id)

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
