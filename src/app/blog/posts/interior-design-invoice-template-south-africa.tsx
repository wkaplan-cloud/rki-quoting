import Link from 'next/link'

export default function InvoiceTemplate() {
  return (
    <article className="prose-content">
      <p className="lead">
        An interior design invoice in South Africa is not just a bill — for VAT-registered studios it is a legal document with specific SARS requirements, and for every studio it is the document that determines how fast you get paid. Here is exactly what your invoice template needs, section by section, and the mistakes that make invoices non-compliant or slow to pay.
      </p>

      <h2>The eight sections of a South African interior design invoice</h2>

      <h3>1. Header and studio identity</h3>
      <p>
        Your logo, studio name, physical address, contact details, and — critically, if you are VAT-registered — your VAT registration number. The words &quot;Tax Invoice&quot; must appear if you are VAT-registered. Company registration number is good practice for Pty Ltd studios.
      </p>

      <h3>2. Client details</h3>
      <p>
        The client&apos;s full name (or company name) and address. For business clients with a VAT number, include it — on invoices over R5,000 SARS requires the recipient&apos;s details for them to claim input VAT.
      </p>

      <h3>3. Invoice number and dates</h3>
      <p>
        A unique, sequential invoice number (for example INV-2026-041), the invoice date, and the payment due date. Never reuse numbers, and keep the sequence unbroken — gaps and duplicates create real pain at SARS reconciliation time.
      </p>

      <h3>4. Reference to the quotation</h3>
      <p>
        Quote number and project name. An invoice that visibly traces to the signed quotation gets queried far less. If this is a deposit or progress invoice, state it: &quot;Deposit invoice — 50% of Quotation Q-2026-018&quot;.
      </p>

      <h3>5. Line items</h3>
      <p>
        Description, quantity, unit price, and line total for each item or service. Match the accepted quotation exactly — same descriptions, same prices. For deposit invoices, a single line referencing the quotation total and the deposit percentage is standard.
      </p>

      <h3>6. Totals: subtotal, VAT, total</h3>
      <p>
        Subtotal excluding VAT, VAT at 15% as its own line, then the total payable. This structure is a SARS requirement for tax invoices, not a stylistic choice. Non-VAT-registered studios should show no VAT line at all — never write &quot;VAT: R0.00&quot;, which confuses clients and misstates your status.
      </p>

      <h3>7. Payment details and terms</h3>
      <p>
        Bank name, account holder, account number, branch code, and the payment reference you want (use the invoice number). State the terms plainly: &quot;Payment due within 7 days&quot; and, if applicable, your late-payment interest clause.
      </p>

      <h3>8. Notes</h3>
      <p>
        Anything the client needs to know: what this invoice covers, what remains to be invoiced, delivery arrangements pending payment. Keep it short.
      </p>

      <h2>Deposit invoice vs final invoice</h2>
      <p>
        The deposit invoice is issued the moment your quotation is accepted, typically for 50%, and VAT applies to it in the period you receive the money. The final invoice shows the project total, less the deposit received (shown clearly as a credit line), with VAT correctly accounted across both documents. Getting this split wrong — double-charging or under-charging VAT across the deposit and final invoice — is one of the most common errors in designer bookkeeping. Our <Link href="/blog/how-to-invoice-clients-interior-design-south-africa" className="text-[#9A7B4F] hover:underline">guide to invoicing clients</Link> covers the full sequence.
      </p>

      <h2>Word and Excel templates: where they fall short</h2>
      <p>
        A Word or Excel invoice template works at low volume, but every invoice is manual: VAT formulas break silently, invoice numbers get duplicated, and nothing connects the invoice to the quotation it came from. The failure mode is not ugly documents — it is a client disputing an invoice that does not match the quote, or an accountant unpicking VAT errors at year-end. We cover the broader cost of manual documents in <Link href="/blog/why-spreadsheets-are-costing-your-interior-design-studio" className="text-[#9A7B4F] hover:underline">why spreadsheets are costing your studio money</Link>.
      </p>

      <h2>The faster route: generate invoices from your quotes</h2>
      <p>
        QuotingHub creates invoices directly from accepted quotations — same line items, correct 15% VAT, sequential numbering, deposit handling, and a branded PDF that meets SARS tax invoice requirements. It pairs with the <Link href="/blog/interior-design-quotation-template-south-africa" className="text-[#9A7B4F] hover:underline">quotation template</Link> workflow so quote and invoice can never drift apart.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>What must an interior design invoice include in South Africa?</h3>
      <p>
        For VAT-registered studios: the words &quot;Tax Invoice&quot;, your business details and VAT number, the client&apos;s details, a unique invoice number and date, an itemised description with quantities and prices, VAT at 15% shown separately, and the total payable, plus banking details and payment terms.
      </p>

      <h3>Do non-VAT-registered designers issue tax invoices?</h3>
      <p>
        No — if you are not VAT registered you issue a standard invoice with no VAT line and no &quot;Tax Invoice&quot; wording. Charging VAT without being registered is unlawful. Once your turnover approaches R1 million in 12 months, plan your registration — see our <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">VAT guide</Link>.
      </p>

      <h3>Is there a free invoice template for SA interior designers?</h3>
      <p>
        Yes — QuotingHub&apos;s 30-day free trial includes full invoicing with SA-compliant formatting, which you can use to issue real invoices before paying anything. No credit card is required to start.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Stop rebuilding invoices by hand.</p>
        <p className="cta-body">QuotingHub turns accepted quotes into SARS-compliant, branded invoices in one click — deposits, VAT, and numbering handled. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
