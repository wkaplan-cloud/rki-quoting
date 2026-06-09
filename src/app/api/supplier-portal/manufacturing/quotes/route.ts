import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET() {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_quotes')
    .select(`
      *,
      job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, contact_person, email))
    `)
    .eq('portal_account_id', auth.portalAccountId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = await createClient()

  // Get or create job
  let jobId = body.job_id
  if (!jobId) {
    const { data: job, error: jobErr } = await supabase
      .from('mfg_jobs')
      .insert({
        portal_account_id: auth.portalAccountId,
        client_id: body.client_id ?? null,
        job_name: body.job_name ?? 'New Job',
      })
      .select('id')
      .single()
    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
    jobId = job.id
  }

  // Get settings for prefix and next number
  const { data: settings } = await supabase
    .from('mfg_settings')
    .select('quote_prefix, default_vat_rate, quote_validity_days')
    .eq('portal_account_id', auth.portalAccountId)
    .maybeSingle()

  // Atomically get next quote number
  const { data: numData } = await supabase
    .rpc('get_next_mfg_quote_number', { p_portal_account_id: auth.portalAccountId })
  const num = String(numData ?? 1).padStart(3, '0')
  const prefix = settings?.quote_prefix ?? 'QUO'
  const quoteNumber = `${prefix}-${num}`

  const validityDays = settings?.quote_validity_days ?? 30
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + validityDays)

  const { data: quote, error } = await supabase
    .from('mfg_quotes')
    .insert({
      portal_account_id: auth.portalAccountId,
      job_id:            jobId,
      quote_number:      quoteNumber,
      revision_number:   1,
      status:            'draft',
      apply_vat:         true,
      vat_rate:          settings?.default_vat_rate ?? 15,
      valid_until:       validUntil.toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(quote)
}
