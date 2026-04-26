export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierRespondClient } from './SupplierRespondClient'

export default async function SupplierRespondPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const { data: ss } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, status, viewed_at, session_id, session:sourcing_sessions(id, title, status, user_id, project:projects(project_name))')
    .eq('token', token)
    .maybeSingle()

  if (!ss) return <ErrorPage message="This link is invalid or has expired." />

  const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
  if (!session) return <ErrorPage message="This pricing request could not be found." />

  if (['cancelled', 'archived'].includes(session.status)) {
    return <ErrorPage message="This pricing request is no longer active." />
  }

  // Mark viewed
  if (!ss.viewed_at) {
    await supabaseAdmin
      .from('sourcing_session_suppliers')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', ss.id)
  }

  const [{ data: assignments }, { data: settings }, { data: messages }] = await Promise.all([
    supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id, status, responded_at, item:sourcing_session_items(*), response:sourcing_item_responses(*)')
      .eq('session_supplier_id', ss.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('settings')
      .select('business_name')
      .eq('user_id', (session as any).user_id)
      .maybeSingle(),
    supabaseAdmin
      .from('sourcing_thread_messages')
      .select('id, sender_type, body, created_at')
      .eq('session_supplier_id', ss.id)
      .order('created_at', { ascending: true }),
  ])

  const mappedAssignments = (assignments ?? []).map((a: any) => ({
    id: a.id,
    status: a.status,
    responded_at: a.responded_at,
    item: Array.isArray(a.item) ? a.item[0] : a.item,
    response: Array.isArray(a.response) ? (a.response[0] ?? null) : a.response,
  }))

  return (
    <SupplierRespondClient
      token={token}
      sessionSupplierId={ss.id}
      supplierName={ss.supplier_name}
      sessionTitle={(session as any).title}
      projectName={(session?.project as any)?.project_name ?? null}
      studioName={settings?.business_name ?? 'Your Studio'}
      assignments={mappedAssignments}
      initialMessages={(messages ?? []) as { id: string; sender_type: 'designer' | 'supplier'; body: string; created_at: string }[]}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8 max-w-md w-full text-center">
        <p className="text-base font-semibold text-[#2C2C2A] mb-2">Request Unavailable</p>
        <p className="text-sm text-[#8A877F]">{message}</p>
        <p className="text-xs text-[#C4BFB5] mt-4">Powered by QuotingHub</p>
      </div>
    </div>
  )
}
