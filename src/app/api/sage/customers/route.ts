import { NextResponse, type NextRequest } from 'next/server'
import { sageGet, sageGetAll } from '@/lib/sage'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

    let items: { ID: number; Name: string }[]

    if (q) {
      // Escape single quotes for OData string literals
      const safe = q.replace(/'/g, "''")
      const data = await sageGet('/Customer/Get', {
        '$filter': `substringof('${safe}',Name) eq true`,
        '$top': 50,
      })
      items = Array.isArray(data) ? data : (data.Results ?? [])
    } else {
      items = await sageGetAll<{ ID: number; Name: string }>('/Customer/Get')
    }

    return NextResponse.json(items.map(c => ({ id: c.ID, name: c.Name })))
  } catch (e: unknown) {
    console.error('[sage/customers]', e)
    return NextResponse.json({ error: 'Failed to fetch Sage customers. Please try again.' }, { status: 500 })
  }
}
