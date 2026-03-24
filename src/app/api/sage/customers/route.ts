import { NextResponse } from 'next/server'
import { sageGet } from '@/lib/sage'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await sageGet('/Customer/Get')
    // SA API returns array directly or wrapped in Results
    const items: { ID: number; Name: string }[] = Array.isArray(data) ? data : (data.Results ?? [])
    return NextResponse.json(items.map(c => ({ id: c.ID, name: c.Name })))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
