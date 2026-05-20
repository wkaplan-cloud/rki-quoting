import { NextResponse } from 'next/server'
import { sageGetAll } from '@/lib/sage'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await sageGetAll<{ ID: number; Name: string }>('/Customer/Get')
    return NextResponse.json(items.map(c => ({ id: c.ID, name: c.Name })))
  } catch (e: unknown) {
    console.error('[sage/customers]', e)
    return NextResponse.json({ error: 'Failed to fetch Sage customers. Please try again.' }, { status: 500 })
  }
}
