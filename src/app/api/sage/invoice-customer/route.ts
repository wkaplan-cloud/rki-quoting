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
    const customer = invoice.Customer ?? invoice.customer
    if (!customer?.ID) return NextResponse.json(null)

    return NextResponse.json({ id: customer.ID, name: customer.Name ?? '' })
  } catch (e: unknown) {
    console.error('[sage/invoice-customer]', e)
    return NextResponse.json(null)
  }
}
