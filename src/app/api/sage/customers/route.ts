import { NextResponse } from 'next/server'
import { sageGet } from '@/lib/sage'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await sageGet('/contacts?contact_type_id=CUSTOMER&items_per_page=200&attributes=id,name,reference')
    const items = data.$items ?? data.items ?? []
    return NextResponse.json(items)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
