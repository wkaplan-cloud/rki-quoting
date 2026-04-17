import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// POST /api/sourcing/[id]/recipients — add a supplier as a recipient (draft only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'draft') {
    return NextResponse.json({ error: 'Cannot add recipients to a sent request' }, { status: 400 })
  }

  const { supplier_id } = await req.json() as { supplier_id: string }
  if (!supplier_id) return NextResponse.json({ error: 'supplier_id required' }, { status: 400 })

  // Fetch supplier details for snapshot
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, supplier_name, email')
    .eq('id', supplier_id)
    .single()

  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  if (!supplier.email) return NextResponse.json({ error: `${supplier.supplier_name} has no email address` }, { status: 400 })

  // Check not already added
  const { data: existing } = await supabase
    .from('sourcing_request_recipients')
    .select('id')
    .eq('sourcing_request_id', id)
    .eq('supplier_id', supplier_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Supplier already added' }, { status: 400 })

  const token = crypto.randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('sourcing_request_recipients')
    .insert({
      sourcing_request_id: id,
      supplier_id: supplier.id,
      supplier_name: supplier.supplier_name,
      email: supplier.email,
      token,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}

// DELETE /api/sourcing/[id]/recipients?recipient_id=xxx — remove a recipient (draft only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recipientId = req.nextUrl.searchParams.get('recipient_id')
  if (!recipientId) return NextResponse.json({ error: 'recipient_id required' }, { status: 400 })

  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'draft') {
    return NextResponse.json({ error: 'Cannot remove recipients from a sent request' }, { status: 400 })
  }

  await supabase
    .from('sourcing_request_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('sourcing_request_id', id)

  return NextResponse.json({ success: true })
}
