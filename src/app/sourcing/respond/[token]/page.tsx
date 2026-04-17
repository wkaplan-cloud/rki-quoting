export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierResponseForm } from './SupplierResponseForm'

export default async function SupplierResponsePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Step 1 — look up recipient by token (no joins, just the row)
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, sourcing_request_id, supplier_name, email, status, viewed_at, responded_at')
    .eq('token', token)
    .maybeSingle()

  if (recipientError || !recipient) {
    return <ErrorPage message="This link is invalid or has expired." />
  }

  // Step 2 — fetch the sourcing request
  const { data: request, error: requestError } = await supabaseAdmin
    .from('sourcing_requests')
    .select('id, user_id, title, specifications, quantity, unit, item_quantity, dimensions, colour_finish, status')
    .eq('id', recipient.sourcing_request_id)
    .maybeSingle()

  if (requestError || !request) {
    return <ErrorPage message="This pricing request could not be found." />
  }

  if (request.status === 'cancelled') {
    return <ErrorPage message="This pricing request has been cancelled." />
  }

  // Step 3 — fetch all remaining data in parallel
  const [
    { data: images },
    { data: responses },
    { data: settings },
  ] = await Promise.all([
    supabaseAdmin
      .from('sourcing_request_images')
      .select('id, url, caption, sort_order')
      .eq('sourcing_request_id', request.id)
      .order('sort_order'),
    supabaseAdmin
      .from('sourcing_request_responses')
      .select('id, unit_price, lead_time_weeks, notes, valid_until, submitted_at, supplier_edits, changed_fields')
      .eq('recipient_id', recipient.id)
      .limit(1),
    supabaseAdmin
      .from('settings')
      .select('business_name')
      .eq('user_id', request.user_id)
      .maybeSingle(),
  ])

  return (
    <SupplierResponseForm
      token={token}
      data={{
        request: {
          id: request.id,
          title: request.title,
          specifications: request.specifications,
          quantity: request.quantity,
          unit: request.unit,
          item_quantity: request.item_quantity,
          dimensions: request.dimensions,
          colour_finish: request.colour_finish,
          status: request.status,
        },
        recipient: {
          id: recipient.id,
          supplier_name: recipient.supplier_name,
          status: recipient.status,
          viewed_at: recipient.viewed_at,
          responded_at: recipient.responded_at,
        },
        response: responses?.[0] ?? null,
        images: images ?? [],
        studio_name: settings?.business_name ?? 'Your Studio',
      }}
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
