import { NextResponse } from 'next/server'
import { sageGet } from '@/lib/sage'

export async function GET() {
  try {
    const data = await sageGet('/contacts?contact_type_id=CUSTOMER&items_per_page=200&attributes=id,name,reference')
    const items = data.$items ?? data.items ?? []
    return NextResponse.json(items)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
