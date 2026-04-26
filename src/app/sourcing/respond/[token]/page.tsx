export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { SupplierRespondClient } from './SupplierRespondClient'
import { SupplierPortalNav } from '@/app/supplier-portal/(authenticated)/SupplierPortalNav'

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

  // Check if the current user is a logged-in supplier portal account — show nav if so
  let portalAccount: { company_name: string | null; email: string; id: string } | null = null
  let pendingCount = 0
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: acct } = await supabaseAdmin
        .from('supplier_portal_accounts')
        .select('id, company_name, email')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (acct) {
        portalAccount = acct
        // Count pending assignments for badge
        const { data: ssRows } = await supabaseAdmin
          .from('sourcing_session_suppliers')
          .select('id')
          .or(`portal_account_id.eq.${acct.id},email.eq.${acct.email}`)
        const ssIds = (ssRows ?? []).map((s: any) => s.id)
        if (ssIds.length > 0) {
          const { count } = await supabaseAdmin
            .from('sourcing_item_assignments')
            .select('id', { count: 'exact', head: true })
            .in('session_supplier_id', ssIds)
            .eq('status', 'pending')
          pendingCount = count ?? 0
        }
      }
    }
  } catch {
    // Unauthenticated — no nav
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

  const content = (
    <SupplierRespondClient
      token={token}
      sessionSupplierId={ss.id}
      supplierName={ss.supplier_name}
      sessionTitle={(session as any).title}
      projectName={(session?.project as any)?.project_name ?? null}
      studioName={settings?.business_name ?? 'Your Studio'}
      assignments={mappedAssignments}
      initialMessages={(messages ?? []) as { id: string; sender_type: 'designer' | 'supplier'; body: string; created_at: string }[]}
      showBackLink={!portalAccount}
    />
  )

  if (portalAccount) {
    return (
      <div className="min-h-screen" style={{ background: '#F4F4F5' }}>
        <SupplierPortalNav
          companyName={portalAccount.company_name ?? portalAccount.email}
          pendingCount={pendingCount}
        />
        <div className="pl-56">
          {content}
        </div>
      </div>
    )
  }

  return content
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F4F4F5' }}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" style={{ border: '1px solid #E4E4E7' }}>
        <p className="text-base font-semibold mb-2" style={{ color: '#18181B' }}>Request Unavailable</p>
        <p className="text-sm" style={{ color: '#71717A' }}>{message}</p>
        <p className="text-xs mt-4" style={{ color: '#A1A1AA' }}>Powered by QuotingHub</p>
      </div>
    </div>
  )
}
