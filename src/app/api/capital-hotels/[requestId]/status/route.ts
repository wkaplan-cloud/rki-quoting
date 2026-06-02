import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/capital-hotels/[requestId]/status — update request status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status } = await req.json() as { status: string }
    const valid = ['pending', 'in_progress', 'quoted']
    if (!valid.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const { data, error } = await supabase
      .from('capital_requests')
      .update({ status })
      .eq('id', requestId)
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data })
  } catch (e) {
    return apiError(e)
  }
}
