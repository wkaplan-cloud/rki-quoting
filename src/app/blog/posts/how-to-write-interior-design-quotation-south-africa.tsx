import Link from 'next/link'

export default function HowToWriteQuotation() {
  return (
    <article className="prose-content">
      <p className="lead">
        A professional quotation is often the first document a potential client receives from your studio. Get it right, and you signal competence before the project even starts. Get it wrong — missing VAT, no deposit terms, unclear line items — and you can lose the job or create expensive disputes later.
      </p>
      <p>
        This guide walks through exactly what to include in an interior design quotation in South Africa, how to structure your pricing, and the VAT and deposit rules SA designers need to know.
      </p>

      <h2>What is an interior design quotation?</h2>
      <p>
        A quotation is a formal price offer to a client for a specific scope of work. It is not a proposal (which outlines your approach) and not an invoice (which requests payment). The quotation comes after the proposal is accepted and before work begins — it commits you to specific prices for a defined period.
      </p>
      <p>
        Once a client accepts a quotation in writing, it becomes a binding agreement. This is why accuracy matters: a poorly calculated quote can lock you into a loss.
      </p>

      <h2>What to include in every interior design quotation</h2>
      <p>Every quotation should contain the following sections:</p>

      <h3>1. Your business details</h3>
      <ul>
        <li>Trading name and legal entity name (if different)</li>
        <li>Physical address and contact details</li>
        <li>VAT registration number (if VAT-registered)</li>
        <li>Logo for a professional finish</li>
      </ul>

      <h3>2. Client details</h3>
      <ul>
        <li>Client full name or company name</li>
        <li>Billing address</li>
        <li>Project site address (if different)</li>
        <li>Contact person and email</li>
      </ul>

      <h3>3. Quotation reference and dates</h3>
      <ul>
        <li>Unique quotation number (e.g. QT-2026-041)</li>
        <li>Date issued</li>
        <li>Validity expiry date (more on this below)</li>
      </ul>

      <h3>4. Itemised line items</h3>
      <p>
        This is the core of the document. Every item, service, and material should be a separate line with a description, quantity, unit price, and line total. Common categories include:
      </p>
      <ul>
        <li>Design fees (concept, documentation, site visits)</li>
        <li>Furniture and loose items (per piece, with supplier reference)</li>
        <li>Fabrics and soft furnishings (per metre or per unit)</li>
        <li>Labour and installation (per hour or per item)</li>
        <li>Sundries and consumables</li>
      </ul>
      <p>
        Avoid vague line items like "lounge furniture — R45,000." Break it down. Clients who can see exactly what they are paying for are far less likely to dispute the quote later.
      </p>

      <h3>5. Subtotal, VAT, and total</h3>
      <p>
        Show a clear subtotal before VAT, then the VAT amount separately, then the grand total. If you are not VAT-registered, state that explicitly: "No VAT applicable — not VAT registered." Never leave it ambiguous.
      </p>

      <h3>6. Deposit requirements</h3>
      <p>
        State upfront what deposit is required to confirm the order and begin procurement. Include the rand value, not just a percentage. For example: "50% deposit of R42,500 required to confirm order."
      </p>

      <h3>7. Payment terms</h3>
      <p>
        Specify when the balance is due — typically on delivery and installation, or on project completion. Include your banking details or a reference to your invoicing process.
      </p>

      <h3>8. Validity period</h3>
      <p>
        This quotation is valid for 30 days from the date of issue. After this date, prices are subject to change. (See more on validity below.)
      </p>

      <h3>9. Acceptance line</h3>
      <p>
        Include a line for the client to sign and date their acceptance. This creates the paper trail you need if disputes arise. Many designers now use e-signature tools or simply accept a written email confirmation.
      </p>

      <h2>How to structure your pricing</h2>
      <p>South African interior designers typically earn from two sources: design fees and product markups.</p>

      <h3>Design fees</h3>
      <p>There are three common structures:</p>
      <ul>
        <li><strong>Percentage of project budget:</strong> Typically 10–15% of the total project cost. Works well for larger projects where your effort scales with the scope.</li>
        <li><strong>Flat project fee:</strong> A fixed amount agreed upfront for a defined scope. Gives clients certainty and protects you if the project runs to schedule.</li>
        <li><strong>Hourly rate:</strong> Typically R650–R2,500/hour depending on experience and location. Useful for consultation-only engagements or when scope is undefined.</li>
      </ul>

      <h3>Product markups</h3>
      <p>
        Most South African designers apply a markup of 20–40% on furniture, fabrics, and accessories sourced for clients. This markup covers your time sourcing, ordering, chasing suppliers, and managing delivery — it is not pure profit. Be transparent with clients about how this works, especially on large-ticket items.
      </p>

      <h2>VAT on interior design quotations in South Africa</h2>
      <p>
        VAT in South Africa is currently 15%. Whether you charge it depends on your registration status with SARS.
      </p>

      <h3>If you are VAT-registered</h3>
      <p>
        You must charge 15% VAT on all taxable supplies and issue a proper tax invoice (not just a quote or receipt). Your tax invoice must include your VAT registration number, the client&apos;s VAT number (if they are also registered), and a clear breakdown of VAT.
      </p>
      <p>
        <strong>VAT on deposits:</strong> SARS requires you to account for VAT at the earlier of when payment is received or when the invoice is issued. This means if a client pays a 50% deposit, you must account for VAT on that deposit amount in that tax period — even before the work is complete.
      </p>

      <h3>If you are not VAT-registered</h3>
      <p>
        Businesses with taxable turnover below R1 million per year are not required to register for VAT. If this is you, do not charge VAT and state clearly on your quotation: "Prices exclude VAT — not a VAT vendor." This avoids confusion and any appearance of charging VAT you are not entitled to collect.
      </p>

      <h2>Deposit terms: what is standard in South Africa?</h2>
      <p>
        The most common deposit structure for SA interior designers is <strong>50% upfront, 50% on completion</strong>. Some studios use 30/70 (30% to confirm, 70% on delivery) for clients who push back on the standard terms.
      </p>
      <p>
        For large projects involving significant supplier orders, it is common to split the deposit further:
      </p>
      <ul>
        <li>Design fee deposit: 50% upfront to begin design work</li>
        <li>Procurement deposit: 100% of supplier costs upfront before placing orders</li>
        <li>Balance of design fee: on project completion</li>
      </ul>
      <p>
        This protects you from being left with custom orders and unpaid supplier invoices if a client pulls out mid-project.
      </p>

      <h2>How long should a quotation be valid?</h2>
      <p>
        30 days is the South African industry standard. For projects involving imported furniture or volatile commodity pricing (timber, metals, fabrics), consider shortening this to 14 days. Supplier prices can change quickly, and a quote accepted 6 weeks after issue can easily be below cost once you factor in price increases.
      </p>
      <p>
        Always include the validity expiry date on the face of the document, not just in your terms. Clients often overlook terms sections but will notice a date next to the total.
      </p>

      <h2>Common mistakes South African designers make on quotations</h2>
      <ol>
        <li><strong>Leaving VAT ambiguous.</strong> Always state explicitly whether prices include or exclude VAT, and whether you are VAT-registered.</li>
        <li><strong>Vague line items.</strong> "Lounge furniture" is not a line item. Each piece needs its own line.</li>
        <li><strong>No validity period.</strong> Without one, you are potentially committed to old prices indefinitely.</li>
        <li><strong>No deposit terms.</strong> Never begin procurement without a confirmed deposit in your account.</li>
        <li><strong>Calculation errors from spreadsheets.</strong> Manual spreadsheet quotes are prone to formula errors, especially when VAT is applied inconsistently across rows.</li>
        <li><strong>No follow-up process.</strong> Most quotes are not accepted on the day they are sent. A follow-up on day 7 and day 25 (before expiry) significantly improves acceptance rates.</li>
      </ol>

      <h2>Make quoting faster and more professional</h2>
      <p>
        Building quotations manually in Excel or Word takes time, introduces errors, and produces inconsistent-looking documents. QuotingHub is built specifically for South African interior designers — it generates professional PDF quotes with automatic VAT calculations, deposit breakdowns, and supplier purchase orders, all from the same platform.
      </p>
      <p>
        Instead of rebuilding a quotation from scratch for every project, you import your supplier price lists once and build quotes by selecting items. VAT is calculated automatically, deposits are split correctly, and the PDF is client-ready in minutes.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Ready to quote faster?</p>
        <p className="cta-body">QuotingHub is free for 30 days. No credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
