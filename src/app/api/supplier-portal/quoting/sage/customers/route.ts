import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getElecPortalAccount, elecSageGetAll } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    const customers = await elecSageGetAll<{ ID: number; Name: string }>(account.id, '/Customer/Get')
    return NextResponse.json({ customers: customers.map(c => ({ id: String(c.ID), name: c.Name })) })
  } catch (e) {
    return apiError(e)
  }
}
