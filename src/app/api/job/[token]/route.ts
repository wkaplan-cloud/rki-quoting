import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: job } = await supabaseAdmin
      .from('elec_jobs')
      .select('id, title, address, notes, scheduled_date, start_time, end_time, status, portal_account_id, staff_id, quote_id')
      .eq('share_token', token)
      .single()

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ data: account }, { data: staff }, { data: photos }] = await Promise.all([
      supabaseAdmin
        .from('supplier_portal_accounts')
        .select('company_name, email, logo_url')
        .eq('id', job.portal_account_id)
        .single(),
      job.staff_id
        ? supabaseAdmin.from('elec_staff').select('name, role, color').eq('id', job.staff_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('elec_job_photos')
        .select('id, public_url, file_name, uploaded_by_name, created_at')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        address: job.address,
        notes: job.notes,
        scheduled_date: job.scheduled_date,
        start_time: job.start_time,
        end_time: job.end_time,
        status: job.status,
      },
      staff: staff ?? null,
      company: account ?? null,
      photos: photos ?? [],
    })
  } catch (e) {
    return apiError(e)
  }
}
