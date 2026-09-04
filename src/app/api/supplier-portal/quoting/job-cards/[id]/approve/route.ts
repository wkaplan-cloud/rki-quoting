import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { notifyJobCardSigned } from '@/lib/notify-job-card-signed'
import { syncJobsFromCardStatus } from '@/lib/elec-job-sync'
import type { ElecJobCardApprovalMethod } from '@/lib/elec-types'

const METHOD_LABEL: Record<string, string> = {
  phone: 'phone', whatsapp: 'WhatsApp', email: 'email', in_person: 'in person',
}

// POST /api/supplier-portal/quoting/job-cards/[id]/approve
//
// Records a client approval given away from the app — on the phone, over
// WhatsApp, by email or in person. Office only, and approval only: nobody but
// the client can sign off that the work was actually done.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const body = await req.json() as {
      approved_by?: string
      approval_method?: ElecJobCardApprovalMethod
      approval_note?: string
    }

    const approvedBy = body.approved_by?.trim()
    if (!approvedBy) {
      return NextResponse.json({ error: 'Enter who approved it' }, { status: 400 })
    }
    const method = body.approval_method
    if (!method || !(method in METHOD_LABEL)) {
      return NextResponse.json({ error: 'Choose how they approved it' }, { status: 400 })
    }

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id, status')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .maybeSingle()
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('elec_job_cards')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        approval_method: method,
        approval_note: body.approval_note?.trim() || null,
        // Recording approval accepts the wording as it stands.
        amended_at: null,
        ...(card.status === 'pending' ? { status: 'in_progress' } : {}),
      })
      .eq('id', id)
    if (error) throw error

    if (card.status === 'pending') await syncJobsFromCardStatus(id, account.id, 'in_progress')

    void notifyJobCardSigned({
      jobCardId: id,
      signerName: approvedBy,
      kind: 'approval',
      source: 'manual',
      methodLabel: METHOD_LABEL[method],
    }).catch(e => console.error('[job-cards/approve] notify failed', e))

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
