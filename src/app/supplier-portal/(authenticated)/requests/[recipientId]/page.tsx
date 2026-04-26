export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// This route now redirects to the unified respond page using the session_supplier token.
// The [recipientId] param is treated as a session_supplier id.
export default async function PortalRequestPage({
  params,
}: {
  params: Promise<{ recipientId: string }>
}) {
  const { recipientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

  const { data: ss } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('token, email')
    .eq('id', recipientId)
    .maybeSingle()

  if (!ss || ss.email.toLowerCase() !== account.email.toLowerCase()) notFound()

  redirect(`/sourcing/respond/${ss.token}`)
}
