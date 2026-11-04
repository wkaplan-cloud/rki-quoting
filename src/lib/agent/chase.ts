import { supabaseAdmin } from '@/lib/supabase/admin'
import { todaySA, toSADate } from '@/lib/dates'
import { buildChaseList, dayOffset, QUOTE_EXPIRED_DAYS, QUOTE_WARN_DAYS, RFQ_GIVE_UP_DAYS, type ChaseList } from './chase-list'

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function loadChaseList(orgId: string): Promise<ChaseList> {
  const today = todaySA()
  const [{ data: docs, error: docsError }, { data: rfqs, error: rfqsError }] = await Promise.all([
    supabaseAdmin
      .from('agent_documents')
      .select(`id, extracted,
        agent_emails(supplier_guess, from_name, suppliers(supplier_name), projects(project_number, project_name))`)
      .eq('org_id', orgId)
      .is('chase_done_at', null)
      .gte('extracted->>valid_until', dayOffset(today, -QUOTE_EXPIRED_DAYS))
      .lte('extracted->>valid_until', dayOffset(today, QUOTE_WARN_DAYS)),
    supabaseAdmin
      .from('rfq_requests')
      .select('id, supplier_name, created_at, opened_at, expires_at, submitted_at, studio_boards(name)')
      .eq('org_id', orgId)
      .is('chase_done_at', null)
      .is('submitted_at', null)
      .gte('created_at', `${dayOffset(today, -RFQ_GIVE_UP_DAYS - 1)}T00:00:00Z`),
  ])
  if (docsError) throw new Error(docsError.message)
  if (rfqsError) throw new Error(rfqsError.message)

  const rfqIds = (rfqs ?? []).map(r => r.id)
  const { data: replies } = rfqIds.length
    ? await supabaseAdmin.from('agent_emails').select('rfq_request_id').eq('org_id', orgId).in('rfq_request_id', rfqIds)
    : { data: [] }
  const repliedByEmail = new Set((replies ?? []).map(r => r.rfq_request_id))

  return buildChaseList(
    (docs ?? []).map(d => {
      const x = d.extracted as { reference?: string | null; valid_until?: string | null; supplier_name?: string | null } | null
      const email = one(d.agent_emails as unknown as {
        supplier_guess: string | null
        from_name: string | null
        suppliers: { supplier_name: string } | { supplier_name: string }[] | null
        projects: { project_number: string | null; project_name: string } | { project_number: string | null; project_name: string }[] | null
      } | null)
      const project = one(email?.projects)
      return {
        id: d.id,
        supplier: one(email?.suppliers)?.supplier_name ?? email?.supplier_guess ?? x?.supplier_name ?? email?.from_name ?? null,
        reference: x?.reference ?? null,
        validUntil: x?.valid_until ?? null,
        project: project ? [project.project_number, project.project_name].filter(Boolean).join(' ') : null,
      }
    }),
    (rfqs ?? []).map(r => ({
      id: r.id,
      supplier: r.supplier_name,
      board: one(r.studio_boards as { name: string } | { name: string }[] | null)?.name ?? null,
      sentOn: toSADate(r.created_at),
      openedAt: r.opened_at,
      linkExpiresOn: toSADate(r.expires_at),
      submitted: !!r.submitted_at,
      repliedByEmail: repliedByEmail.has(r.id),
    })),
    today,
  )
}
