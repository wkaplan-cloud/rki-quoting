import Link from 'next/link'

export default function HowToInvoiceClients() {
  return (
    <article className="prose-content">
      <p className="lead">
        Quoting wins the project; invoicing gets you paid. For South African interior designers, invoicing has specific rules — SARS tax invoice requirements, VAT on deposits, and payment terms that protect your cash flow when suppliers demand payment long before clients see a finished room. This guide covers the full invoicing workflow for an SA studio.
      </p>

      <h2>The invoicing sequence for a design project</h2>
      <p>
        Most South African studios invoice in stages that mirror the flow of money out to suppliers:
      </p>
      <ul>
        <li><strong>1. Deposit invoice</strong> — issued as soon as the client accepts your quotation, typically for 50% of the project value. Nothing gets ordered before this clears.</li>
        <li><strong>2. Progress invoice(s)</strong> — on longer projects, a mid-project invoice (often at delivery of major items or completion of a milestone).</li>
        <li><strong>3. Final invoice</strong> — the balance, issued at practical completion or final installation, before handover of the styled space.</li>
      </ul>
      <p>
        The invoice should always trace back to the accepted quotation — same line items, same prices. If the scope changed, issue a revised quotation or a variation first, then invoice against it. Disputes almost always come from invoices that do not match what the client signed.
      </p>

      <h2>What a valid SA tax invoice must include</h2>
      <p>
        If you are VAT-registered, SARS requires a full tax invoice (for amounts over R5,000) to contain:
      </p>
      <ul>
        <li>The words &quot;Tax Invoice&quot;, &quot;VAT Invoice&quot; or &quot;Invoice&quot;</li>
        <li>Your business name, address, and VAT registration number</li>
        <li>The client&apos;s name and address (and VAT number if they are registered and the invoice exceeds R5,000)</li>
        <li>A unique invoice number and the invoice date</li>
        <li>A description of the goods or services supplied</li>
        <li>Quantities and prices</li>
        <li>The VAT amount shown separately, or a statement that VAT is included at 15%</li>
        <li>The total amount payable</li>
      </ul>
      <p>
        Missing details here are not cosmetic — your client cannot claim input VAT on a defective tax invoice, which matters enormously to commercial clients. For the full VAT picture, see our <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">guide to VAT on interior design services</Link>.
      </p>

      <h2>VAT on deposits: the trap that catches designers</h2>
      <p>
        Under South African VAT law, receiving a deposit that forms part of the payment for a supply creates a tax point. If you are VAT-registered and receive a R115,000 deposit (R100,000 + R15,000 VAT), that R15,000 output VAT is due to SARS in the VAT period you received the deposit — not when the project finishes. Budget for this: the deposit is not all yours to spend on supplier orders.
      </p>

      <h2>Payment terms that protect your cash flow</h2>
      <ul>
        <li><strong>Deposit before ordering — always.</strong> Custom and made-to-order items from SA suppliers are typically non-refundable. Never place a supplier order against a promised deposit.</li>
        <li><strong>Short terms on final invoices.</strong> 7 days is reasonable for residential clients; 30 days is common for commercial. Do not default to 30 days for private clients out of habit.</li>
        <li><strong>Link handover to payment.</strong> Final styling, installation sign-off, or delivery of loose items is a natural point of leverage — use it politely but deliberately.</li>
        <li><strong>Invoice immediately.</strong> The single biggest self-inflicted cash flow wound is invoicing days or weeks after the trigger event. Invoice the same day the milestone happens.</li>
      </ul>

      <h2>Following up on late payment</h2>
      <p>
        A simple, unemotional escalation works: a friendly reminder the day after due date, a firmer note at 7 days referencing the agreed terms, a phone call at 14 days, and suspension of remaining work or deliveries after that. Putting late-payment interest in your quotation terms (and contract) gives these follow-ups teeth. Most late payment in the design industry is disorganisation, not refusal — consistent, prompt follow-up resolves the majority of it.
      </p>

      <h2>Keeping invoices and accounting in sync</h2>
      <p>
        Double-capturing invoices — once in your quoting tool, once in your accounting system — is where errors breed. QuotingHub generates invoices directly from accepted quotations and, on the Agency plan, syncs with Sage Business Cloud Accounting, so your accountant sees the same numbers your client does. Payment status can be tracked against each invoice, so you always know what is outstanding across every project.
      </p>

      <h2>Common invoicing mistakes SA designers make</h2>
      <ul>
        <li>Invoicing from a different document than the accepted quote, creating mismatches the client queries.</li>
        <li>Forgetting that the deposit already included VAT, and double-charging or under-charging VAT on the final invoice.</li>
        <li>Leaving the VAT number off the invoice — instantly non-compliant for VAT-registered studios.</li>
        <li>Reusing invoice numbers or leaving gaps that make SARS reconciliation painful.</li>
        <li>Waiting until month-end to invoice milestones that happened mid-month.</li>
      </ul>

      <h2>Frequently asked questions</h2>

      <h3>When should an interior designer invoice the client?</h3>
      <p>
        Immediately at each trigger point: the deposit invoice the moment the quotation is accepted, progress invoices when the agreed milestone occurs, and the final invoice at practical completion. Same-day invoicing at each trigger is the single best habit for studio cash flow.
      </p>

      <h3>Do I charge VAT on the deposit invoice?</h3>
      <p>
        If you are VAT-registered, yes — the deposit is consideration for a taxable supply, and the VAT portion is due to SARS in the period you receive the deposit. Show VAT separately on the deposit invoice like any other tax invoice.
      </p>

      <h3>What payment terms should I give clients?</h3>
      <p>
        Deposit payable immediately on acceptance (before any orders are placed), and final invoices at 7 days for residential clients or up to 30 days for commercial clients. State the terms on the quotation, the contract, and the invoice itself so there is never ambiguity.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Invoices that match your quotes, automatically.</p>
        <p className="cta-body">QuotingHub turns accepted quotations into SARS-compliant invoices with 15% VAT handled for you — and syncs with Sage. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
