import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// DELETE /api/sourcing/sessions/[id]/suppliers/[supplierId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  try {
    const { supplierId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('sourcing_session_suppliers').delete().eq('id', supplierId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
