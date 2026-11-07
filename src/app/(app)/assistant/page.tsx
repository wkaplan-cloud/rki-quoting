export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentOrgId } from '@/lib/auth-context'
import { agentEnabled } from '@/lib/agent/gate'
import { driveAccountEmail } from '@/lib/agent/drive'
import { loadChaseList } from '@/lib/agent/chase'
import { withTeamNames } from '@/lib/agent/recipients'
import { AssistantView, type AgentEmailRow, type MailboxInfo } from './AssistantView'

// The studio assistant's desk: what came into its inbox, where it filed each
// email, and what it thinks needs a person. Behind settings.agent_enabled.
export default async function AssistantPage() {
  const orgId = await getCurrentOrgId()
  if (!orgId || !(await agentEnabled(orgId))) redirect('/dashboard')

  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [{ data: mailbox }, { data: emails }, { data: projects }, { data: clients }, { data: suppliers }, { data: usage }, { data: team }, chase] = await Promise.all([
    supabaseAdmin
      .from('agent_mailboxes')
      .select('agent_name, email, last_received_at, last_error, drive_folder_id, credit_out_at')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('agent_emails')
      .select(`id, from_email, from_name, subject, sent_to, sent_cc, received_at, kind, supplier_id, supplier_guess, project_id,
        rfq_request_id, match_confidence, match_reason, summary, action_needed, status, error, created_at,
        agent_documents(id, filename, doc_type, extracted, read_error, storage_path, drive_link, drive_parent_id, drive_error)`)
      .order('received_at', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('projects')
      .select('id, project_number, project_name, clients(client_name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, client_name, company').order('client_name'),
    supabase.from('suppliers').select('id, supplier_name').order('supplier_name'),
    supabase.from('agent_usage').select('email_id, cost_usd, created_at').gte('created_at', lastMonthStart.toISOString()),
    supabaseAdmin.from('org_members').select('invited_email, full_name').eq('org_id', orgId).eq('status', 'active'),
    loadChaseList(orgId),
  ])

  const teamNames = new Map(
    (team ?? []).filter(m => m.invited_email && m.full_name).map(m => [m.invited_email.toLowerCase(), m.full_name]),
  )

  // Rand estimate at a fixed rate: Anthropic bills in dollars, and this is a
  // guide to what reading mail costs, not the invoice.
  const usdZar = Number(process.env.AGENT_USD_ZAR) || 18.5
  const sum = (rows: { cost_usd: number | string }[]) => rows.reduce((t, r) => t + Number(r.cost_usd), 0) * usdZar
  const thisMonth = (usage ?? []).filter(u => new Date(u.created_at) >= monthStart)
  const lastMonth = (usage ?? []).filter(u => new Date(u.created_at) < monthStart)
  const emailsRead = new Set(thisMonth.map(u => u.email_id)).size
  const costs = {
    thisMonth: sum(thisMonth),
    lastMonth: sum(lastMonth),
    perEmail: emailsRead ? sum(thisMonth) / emailsRead : null,
    emailsRead,
    usdZar,
  }

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

  return (
    <AssistantView
      mailbox={(mailbox as MailboxInfo | null) ?? null}
      driveAccount={driveAccountEmail()}
      costs={costs}
      chase={chase}
      emails={((emails ?? []) as unknown as AgentEmailRow[]).map(e => ({
        ...e,
        sent_to: withTeamNames(e.sent_to, teamNames),
        sent_cc: withTeamNames(e.sent_cc, teamNames),
      }))}
      projects={(projects ?? []).map(p => ({
        id: p.id,
        label: [p.project_number, p.project_name, one(p.clients as { client_name: string } | { client_name: string }[] | null)?.client_name]
          .filter(Boolean).join(' · '),
      }))}
      clients={(clients ?? []).map(c => ({ id: c.id, name: c.client_name, label: c.company ? `${c.client_name} — ${c.company}` : c.client_name }))}
      suppliers={(suppliers ?? []).map(s => ({ id: s.id, label: s.supplier_name }))}
    />
  )
}
