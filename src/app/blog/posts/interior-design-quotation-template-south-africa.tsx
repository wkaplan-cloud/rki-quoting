import Link from 'next/link'

export default function QuotationTemplateSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        A well-structured interior design quotation template saves you time on every project and prevents the errors and disputes that come from building quotes from scratch each time. This guide walks through exactly what your template should contain — and how South African designers can use it to quote faster and look more professional from day one.
      </p>

      <h2>What every interior design quotation template needs</h2>
      <p>
        Before looking at structure, it helps to understand what a quotation is for. A quotation is a priced offer to a client for a defined scope of work, valid for a set period. It is not a proposal (which describes your approach) and not a tax invoice (which requests payment). Your template must make the price, scope, and terms unmistakably clear.
      </p>
      <p>Every solid SA interior design quotation template contains these sections:</p>
      <ol>
        <li>Studio header with branding and VAT number (if registered)</li>
        <li>Client and project details</li>
        <li>Quotation reference number and dates</li>
        <li>Itemised line items table</li>
        <li>Subtotal, VAT, and total</li>
        <li>Deposit terms</li>
        <li>Payment terms</li>
        <li>Validity period</li>
        <li>Terms and acceptance</li>
      </ol>

      <h2>Section-by-section: how to structure your template</h2>

      <h3>Studio header</h3>
      <p>Your header should include:</p>
      <ul>
        <li>Studio name and logo</li>
        <li>Physical address (required on a tax invoice)</li>
        <li>Contact number and email</li>
        <li>VAT registration number — displayed prominently if you are registered. If you are not VAT-registered, do not include a VAT number field.</li>
        <li>The word <strong>QUOTATION</strong> or <strong>TAX INVOICE</strong> clearly at the top — these are different documents and clients must know which they are receiving</li>
      </ul>

      <h3>Client and project details</h3>
      <ul>
        <li>Client full name or company name</li>
        <li>Client billing address</li>
        <li>Project address (if different)</li>
        <li>Client contact person and email</li>
        <li>Client VAT number (if applicable and they are VAT-registered)</li>
      </ul>

      <h3>Quotation reference and dates</h3>
      <ul>
        <li>Unique quotation number (e.g. QT-2026-047). Sequential numbering helps with your records and looks professional.</li>
        <li>Date of issue</li>
        <li>Valid until date — typically 30 days from issue. For projects with imported furniture or volatile commodity pricing, consider 14 days.</li>
      </ul>

      <h3>Itemised line items table</h3>
      <p>
        This is the core of your template. Use a table with at minimum four columns: <strong>Description, Quantity, Unit Price, Line Total</strong>. Optionally add a Supplier or Reference column.
      </p>
      <p>
        Every item should have its own row. Avoid grouped lines like "Lounge furniture — R58,000." Instead:
      </p>
      <ul>
        <li>3-seater sofa (ref: TL-204, fabric: Warwick Tusk) — 1 × R18,500 = R18,500</li>
        <li>Armchair (ref: TL-206, fabric: Warwick Tusk) — 2 × R9,200 = R18,400</li>
        <li>Coffee table (ref: CM-089, solid oak) — 1 × R7,800 = R7,800</li>
      </ul>
      <p>
        Group related items under a category heading (Lounge, Main Bedroom, Kitchen, Design Fees) using a shaded header row. This makes long quotes readable without losing the detail.
      </p>

      <h3>VAT and totals section</h3>
      <p>Your totals section must clearly show:</p>
      <ul>
        <li><strong>Subtotal (excl. VAT)</strong></li>
        <li><strong>VAT at 15%</strong> — or "No VAT — not a VAT vendor" if not registered</li>
        <li><strong>Total (incl. VAT)</strong></li>
      </ul>
      <p>
        Never write a single total without clarifying whether it includes or excludes VAT. Ambiguity here is one of the most common sources of client disputes in SA interior design projects.
      </p>

      <h3>Deposit and payment terms</h3>
      <p>
        State the deposit as a rand amount, not just a percentage. Example: "A 50% deposit of <strong>R34,250</strong> is required to confirm this order and begin procurement." This avoids any calculation confusion.
      </p>
      <p>Standard SA deposit structures:</p>
      <ul>
        <li>50% deposit to confirm, 50% on delivery/completion — most common</li>
        <li>100% of supplier costs upfront before orders are placed — used for high-value procurement</li>
        <li>Design fee: 50% upfront; Product costs: 100% before ordering</li>
      </ul>
      <p>
        Include your banking details or a clear instruction on how to pay (EFT, reference to use).
      </p>

      <h3>Validity and acceptance</h3>
      <p>
        Two lines that are frequently missing from SA designer quotes — and frequently cause problems when they are:
      </p>
      <ul>
        <li>"This quotation is valid for 30 days from the date of issue. After [expiry date], prices are subject to change."</li>
        <li>A signature block: "I/We accept the above quotation. Signed: _______ Date: _______"</li>
      </ul>
      <p>
        Many SA designers now accept written email confirmation in lieu of a physical signature. If you do this, state it in your terms: "Written email confirmation of acceptance constitutes agreement to these terms."
      </p>

      <h2>Common template mistakes South African designers make</h2>
      <ul>
        <li><strong>No VAT clarification.</strong> Whether you charge VAT or not, it must be stated explicitly.</li>
        <li><strong>Grouped line items.</strong> "Bedroom furniture" without a breakdown invites renegotiation.</li>
        <li><strong>No unique quote number.</strong> You need this for your records, SARS, and follow-up communication.</li>
        <li><strong>No validity date.</strong> Without it, you may be held to old prices months later.</li>
        <li><strong>Deposit amount in % only.</strong> Always state the rand value too.</li>
        <li><strong>No acceptance mechanism.</strong> A quote not formally accepted is not an agreement.</li>
      </ul>

      <h2>Using a template vs purpose-built quoting software</h2>
      <p>
        A Word or Excel template is a reasonable starting point, but it creates friction at scale. Every project requires:
      </p>
      <ul>
        <li>Manually re-entering supplier prices (which change constantly)</li>
        <li>Recalculating VAT across every line</li>
        <li>Reformatting for each client</li>
        <li>Converting to PDF and emailing manually</li>
        <li>Tracking which version the client accepted</li>
      </ul>
      <p>
        QuotingHub replaces the template entirely. You import your supplier price lists once, build quotes by selecting items, and the system handles VAT, deposit calculations, PDF generation, and delivery — in minutes per project rather than hours.
      </p>
      <p>
        For more on writing the actual content of your quotation, see our guide on <Link href="/blog/how-to-write-interior-design-quotation-south-africa" className="text-[#9A7B4F] hover:underline">how to write an interior design quotation in South Africa</Link>.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>Can I use a Word or Excel template for my interior design quotes?</h3>
      <p>
        Yes, and many SA designers start this way. The main risks are formula errors in Excel (especially with VAT), inconsistent formatting across clients, and no audit trail of accepted versions. As your project volume grows, purpose-built software becomes significantly faster and less error-prone.
      </p>

      <h3>What is the difference between a quotation and a tax invoice?</h3>
      <p>
        A quotation is a priced offer — it becomes binding when the client accepts it but does not trigger a VAT liability. A tax invoice is issued when you request payment for goods or services already delivered or agreed. If you are VAT-registered, you must issue a compliant tax invoice (not a quote) to support the client&apos;s VAT input claim.
      </p>

      <h3>How long should my quotation be valid for?</h3>
      <p>
        30 days is standard in South Africa. For projects involving imported items or materials with volatile pricing, 14 days is more appropriate. Always state the expiry date explicitly on the document.
      </p>

      <h3>Does my quotation need to include my VAT number?</h3>
      <p>
        Only if you are VAT-registered with SARS. If you are not registered, do not include a VAT number and do not charge VAT. If you are registered, your VAT number must appear on every tax invoice and is good practice on quotations too.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Skip the template. Use QuotingHub.</p>
        <p className="cta-body">Auto-calculate VAT, generate PDF quotes, and send them to clients — all in one place. Built for South African interior designers.</p>
        <Link href="/signup" className="cta-button">Try free for 30 days</Link>
      </div>
    </article>
  )
}
