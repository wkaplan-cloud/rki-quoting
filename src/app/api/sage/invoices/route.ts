import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await sageGet('/TaxInvoice/Get')
    const invoices: Record<string, unknown>[] = Array.isArray(data) ? data : (data.Results ?? [])

    const mapped = invoices
      .filter(inv => {
        const status = String(inv.Status ?? inv.status ?? '').toUpperCase()
        return status !== 'PAID' && status !== 'CANCELLED' && status !== 'VOID'
      })
      .map(inv => ({
        id: String(inv.ID ?? inv.id),
        reference: inv.Reference ?? inv.reference ?? '',
        customerName: (inv.Customer as Record<string, unknown>)?.Name ?? inv.CustomerName ?? '—',
        total: inv.Total ?? inv.total ?? 0,
        status: inv.Status ?? inv.status ?? 'DRAFT',
        date: inv.Date ?? inv.date ?? '',
      }))

    return NextResponse.json(mapped)
  } catch (e: unknown) {
    console.error('[sage/invoices]', e)
    return NextResponse.json({ error: 'Failed to fetch Sage invoices. Please try again.' }, { status: 500 })
  }
}
