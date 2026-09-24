import { elecSageGet, elecSagePost } from '@/lib/sage-elec'

/**
 * Creates (or updates) a one-line tax invoice in Sage Business Cloud
 * Accounting for a trades account. Shared by progress claims and support-plan
 * invoices so both send Sage the same shape.
 */
export async function pushSageInvoice(opts: {
  portalAccountId: string
  sageCustomerId: string
  /** The Sage item the line sells (elec_settings.sage_item_id). */
  selectionId: number
  reference: string
  description: string
  lineDescription: string
  amountExclVat: number
  dueDate: Date
  /** Update this invoice instead of creating one, when it still exists. */
  existingSageId?: string | null
}): Promise<{ id: string; status: string }> {
  const { portalAccountId, sageCustomerId } = opts

  const [taxTypesResp, customerRaw] = await Promise.all([
    elecSageGet(portalAccountId, '/TaxType/Get'),
    elecSageGet(portalAccountId, `/Customer/Get/${Number(sageCustomerId)}`).catch(() =>
      elecSageGet(portalAccountId, '/Customer/Get', { '$filter': `ID eq ${Number(sageCustomerId)}`, '$top': 1 }).catch(() => null)
    ),
  ])

  const customerResp: Record<string, unknown> | null =
    customerRaw?.Results?.[0] ??
    (Array.isArray(customerRaw) ? customerRaw[0] : null) ??
    (customerRaw?.ID ? customerRaw : null)

  const defaultTaxType = (taxTypesResp.Results ?? []).find(
    (t: { IsDefault?: boolean; CompanyId?: number }) => t.IsDefault && (t.CompanyId ?? 0) > 0
  )
  const taxTypeId: number = defaultTaxType?.ID ?? 146922

  const toSageDate = (d: Date) => `/Date(${d.getTime()})/`

  // Copy the customer's address fields onto the invoice
  const customerFields: Record<string, unknown> = {}
  if (customerResp) {
    const taxRef = customerResp.TaxReference ?? customerResp.TaxNumber ?? customerResp.VatRegistrationNumber ?? null
    if (taxRef) customerFields.TaxReference = taxRef
    for (let i = 1; i <= 5; i++) {
      const da = customerResp[`DeliveryAddress0${i}`]
      const pa = customerResp[`PostalAddress0${i}`]
      if (da !== undefined) customerFields[`DeliveryAddress0${i}`] = da
      if (pa !== undefined) customerFields[`PostalAddress0${i}`] = pa
    }
  }

  const payload: Record<string, unknown> = {
    CustomerID: Number(sageCustomerId),
    Date: toSageDate(new Date()),
    DueDate: toSageDate(opts.dueDate),
    Inclusive: false,
    Reference: opts.reference,
    Description: opts.description.length > 100 ? opts.description.slice(0, 97) + '…' : opts.description,
    Lines: [{
      SelectionId: opts.selectionId,
      LineType: 0,
      Description: opts.lineDescription,
      Quantity: 1,
      UnitPriceExclusive: opts.amountExclVat,
      TaxTypeId: taxTypeId,
    }],
    ...customerFields,
  }

  let invoice: Record<string, unknown>
  if (opts.existingSageId) {
    try {
      invoice = await elecSagePost(portalAccountId, '/TaxInvoice/Save', { ...payload, ID: Number(opts.existingSageId) })
    } catch {
      invoice = await elecSagePost(portalAccountId, '/TaxInvoice/Save', payload)
    }
  } else {
    invoice = await elecSagePost(portalAccountId, '/TaxInvoice/Save', payload)
  }

  return { id: String(invoice.ID ?? invoice.id), status: String(invoice.Status ?? invoice.status ?? 'DRAFT') }
}
