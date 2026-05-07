import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await sageGet('/Item/Get')
    const results = (data.Results ?? data ?? []) as Array<{ ID: number; Description?: string; Code?: string; Name?: string }>
    const items = results.map(item => ({
      id: item.ID,
      label: item.Description ?? item.Name ?? item.Code ?? `Item ${item.ID}`,
      code: item.Code ?? '',
    }))
    return NextResponse.json({ items })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
