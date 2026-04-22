export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierPortalRequestDetail } from './SupplierPortalRequestDetail'

export default async function PortalRequestPage({
  params,
}: {
  params: Promise<{ recipientId: string }>
}) {
  const { recipientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) redirect('/supplier-portal/login')

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, supplier_name, email, status, token, sent_at, viewed_at, responded_at, sourcing_request_id')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || recipient.email.toLowerCase() !== portalAccount.email.toLowerCase()) {
    notFound()
  }

  const { data: request } = await supabaseAdmin
    .from('sourcing_requests')
    .select('id, title, work_type, specifications, item_quantity, dimensions, colour_finish, status, user_id')
    .eq('id', recipient.sourcing_request_id)
    .single()

  if (!request) notFound()

  const [
    { data: responses },
    { data: images },
    { data: messages },
    { data: settings },
  ] = await Promise.all([
    supabaseAdmin
      .from('sourcing_request_responses')
      .select('id, unit_price, lead_time_weeks, notes, valid_until, submitted_at, supplier_edits, changed_fields, attachment_url')
      .eq('recipient_id', recipientId)
      .limit(1),
    supabaseAdmin
      .from('sourcing_request_images')
      .select('id, url, caption, sort_order')
      .eq('sourcing_request_id', recipient.sourcing_request_id)
      .order('sort_order'),
    supabaseAdmin
      .from('sourcing_messages')
      .select('id, sender_type, body, created_at')
      .eq('recipient_id', recipientId)
      .order('created_at'),
    supabaseAdmin
      .from('settings')
      .select('business_name')
      .eq('user_id', request.user_id)
      .maybeSingle(),
  ])

  return (
    <SupplierPortalRequestDetail
      recipientId={recipientId}
      data={{
        request: {
          id: request.id,
          title: request.title,
          work_type: request.work_type ?? null,
          specifications: request.specifications,
          item_quantity: request.item_quantity,
          dimensions: request.dimensions,
          colour_finish: request.colour_finish,
          status: request.status,
        },
        recipient: {
          id: recipient.id,
          supplier_name: recipient.supplier_name,
          status: recipient.status,
          token: recipient.token,
          sent_at: recipient.sent_at,
          viewed_at: recipient.viewed_at,
          responded_at: recipient.responded_at,
        },
        response: responses?.[0] ?? null,
        images: images ?? [],
        initialMessages: (messages ?? []) as { id: string; sender_type: 'designer' | 'supplier'; body: string; created_at: string }[],
        studio_name: settings?.business_name ?? 'Studio',
      }}
    />
  )
}
