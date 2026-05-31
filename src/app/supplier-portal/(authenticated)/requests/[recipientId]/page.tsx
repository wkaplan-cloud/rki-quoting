export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'

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

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const { data: ss } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('token, email, portal_account_id')
    .eq('id', recipientId)
    .maybeSingle()

  if (!ss) notFound()

  const emailMatch = ss.email.toLowerCase() === account.email.toLowerCase()
  const directMatch = (ss as any).portal_account_id === account.id
  if (!emailMatch && !directMatch) notFound()

  redirect(`/sourcing/respond/${ss.token}`)
}
