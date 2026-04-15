import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, unknown> = {}
  for (const path of ['/TaxInvoice/Get', '/Quote/Get', '/SalesOrder/Get']) {
    try {
      results[path] = await sageGet(path)
    } catch (e: unknown) {
      results[path] = { error: e instanceof Error ? e.message : String(e) }
    }
  }
  return NextResponse.json(results)
}
