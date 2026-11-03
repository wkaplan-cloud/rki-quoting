export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentOrgId } from '@/lib/auth-context'
import { agentEnabled } from '@/lib/agent/gate'
import { AssistantView, type AgentEmailRow, type MailboxInfo } from './AssistantView'

// The studio assistant's desk: what came into its inbox, where it filed each
// email, and what it thinks needs a person. Behind settings.agent_enabled.
export default async function AssistantPage() {
  const orgId = await getCurrentOrgId()
  if (!orgId || !(await agentEnabled(orgId))) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: mailbox }, { data: emails }, { data: projects }, { data: suppliers }] = await Promise.all([
    supabaseAdmin
      .from('agent_mailboxes')
      .select('agent_name, email, last_received_at, last_error')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('agent_emails')
      .select(`id, from_email, from_name, subject, received_at, kind, supplier_id, supplier_guess, project_id,
        rfq_request_id, match_confidence, match_reason, summary, action_needed, status, error, created_at,
        agent_documents(id, filename, doc_type, extracted, read_error, storage_path)`)
      .order('received_at', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('projects')
      .select('id, project_number, project_name, clients(client_name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id, supplier_name').order('supplier_name'),
  ])

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

  return (
    <AssistantView
      mailbox={(mailbox as MailboxInfo | null) ?? null}
      emails={(emails ?? []) as unknown as AgentEmailRow[]}
      projects={(projects ?? []).map(p => ({
        id: p.id,
        label: [p.project_number, p.project_name, one(p.clients as { client_name: string } | { client_name: string }[] | null)?.client_name]
          .filter(Boolean).join(' · '),
      }))}
      suppliers={(suppliers ?? []).map(s => ({ id: s.id, label: s.supplier_name }))}
    />
  )
}
