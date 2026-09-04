import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { notifyJobCardSigned } from '@/lib/notify-job-card-signed'

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
    // The name is what makes the signature proof of who approved the work.
    const signer = signerName?.trim()
    if (!signer) {
      return NextResponse.json({ error: 'Enter the name of the person signing' }, { status: 400 })
    }

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id, portal_account_id, client_signature_url, job_number, title, status')
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

    // Same shape the on-site flow writes: the signature is a captioned photo,
    // and the PDF reads the signer's name off that caption.
    await supabaseAdmin.from('elec_job_card_photos').insert({
      job_card_id: card.id,
      url: publicUrl,
      caption: signer,
    })

    await supabaseAdmin
      .from('elec_job_cards')
      .update({
        client_signature_url: publicUrl,
        sent_to_name: signer,
        share_token: null,
        // The signature covers the wording as it stands right now.
        amended_at: null,
        // Approving the card is the client saying go — take it off pending.
        ...(card.status === 'pending' ? { status: 'in_progress' } : {}),
      })
      .eq('id', card.id)

    await notifyJobCardSigned({ jobCardId: card.id, signerName: signer, source: 'email_link' })
      .catch(e => console.error('[job-sign] notify failed', e))

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
