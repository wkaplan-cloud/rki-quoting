export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierResponseForm } from './SupplierResponseForm'

export default async function SupplierResponsePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Fetch via admin client (bypasses RLS — token is the access control)
  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('*, sourcing_requests(*), sourcing_request_responses(*)')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) notFound()

  const request = recipient.sourcing_requests as {
    id: string
    user_id: string
    title: string
    specifications: string | null
    quantity: number
    unit: string | null
    dimensions: string | null
    colour_finish: string | null
    status: string
  } | null

  if (!request || request.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8 max-w-md w-full text-center">
          <p className="text-base font-semibold text-[#2C2C2A] mb-2">Request Unavailable</p>
          <p className="text-sm text-[#8A877F]">This pricing request is no longer active.</p>
        </div>
      </div>
    )
  }

  // Fetch images and studio name in parallel
  const [{ data: images }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from('sourcing_request_images')
      .select('*')
      .eq('sourcing_request_id', request.id)
      .order('sort_order'),
    supabaseAdmin
      .from('settings')
      .select('business_name')
      .eq('user_id', request.user_id)
      .maybeSingle(),
  ])

  const responses = Array.isArray(recipient.sourcing_request_responses)
    ? recipient.sourcing_request_responses
    : recipient.sourcing_request_responses
      ? [recipient.sourcing_request_responses]
      : []

  const existingResponse = responses[0] ?? null

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
        response: existingResponse,
        images: images ?? [],
        studio_name: settings?.business_name ?? 'Your Studio',
      }}
    />
  )
}
