import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoiceId = req.nextUrl.searchParams.get('invoiceId')
    if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })

    const invoice = await sageGet(`/TaxInvoice/Get/${invoiceId}`)

    // Sage returns either a nested Customer object or flat CustomerID/CustomerName fields
    const nested = invoice.Customer ?? invoice.customer
    const id = nested?.ID ?? nested?.Id ?? invoice.CustomerID ?? invoice.CustomerId ?? null
    const name = nested?.Name ?? invoice.CustomerName ?? ''

    if (!id) return NextResponse.json(null)

    return NextResponse.json({ id: String(id), name })
  } catch (e: unknown) {
    console.error('[sage/invoice-customer]', e)
    return NextResponse.json(null)
  }
}
