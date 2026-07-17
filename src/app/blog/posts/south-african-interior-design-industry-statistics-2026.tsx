import Link from 'next/link'

export default function IndustryStatistics() {
  return (
    <article className="prose-content">
      <p className="lead">
        The key numbers for the South African interior design industry in 2026, gathered in one place: what designers charge, standard markups and deposits, VAT thresholds, professional registration, and what it costs to run a studio. Cite this page freely — it is maintained and updated as figures change.
      </p>

      <h2>What SA interior designers charge (2026)</h2>
      <ul>
        <li><strong>Hourly rates:</strong> junior designers typically R400–R800/hour; mid-level practitioners R800–R1,500/hour; senior and specialist designers R1,500–R2,500+/hour, with meaningful variation between major centres and smaller cities.</li>
        <li><strong>Percentage fees:</strong> commonly 10–15% of project budget for residential work.</li>
        <li><strong>Procurement markup:</strong> 15–30% on supplier net prices, with 20% the most common figure.</li>
        <li><strong>Trade discounts from suppliers:</strong> commonly 10–30% off retail, varying by supplier and category.</li>
      </ul>
      <p>
        Full context and how to choose between models: <Link href="/blog/interior-design-fee-structure-south-africa" className="text-[#9A7B4F] hover:underline">SA fee structure guide</Link>.
      </p>

      <h2>Standard commercial terms in the SA design industry</h2>
      <ul>
        <li><strong>Deposit:</strong> 50% upfront is the standard, with 60/40 and 70/30 splits used on custom-heavy projects.</li>
        <li><strong>Quotation validity:</strong> 30 days standard; 45–60 days sometimes offered on large commercial work.</li>
        <li><strong>Payment terms on final invoices:</strong> commonly 7 days residential, up to 30 days commercial.</li>
        <li><strong>Custom items:</strong> made-to-order and cut goods are typically non-cancellable and non-refundable once ordered from SA suppliers.</li>
      </ul>

      <h2>Tax and compliance numbers (2026)</h2>
      <ul>
        <li><strong>VAT rate:</strong> 15%.</li>
        <li><strong>Compulsory VAT registration:</strong> taxable turnover above R1 million in any consecutive 12-month period, with registration required within 21 days of crossing the threshold.</li>
        <li><strong>Voluntary VAT registration:</strong> available from R50,000 turnover per year.</li>
        <li><strong>Full tax invoice threshold:</strong> invoices over R5,000 require the recipient&apos;s details for input VAT claims.</li>
        <li><strong>VAT on deposits:</strong> a deposit creates a tax point when received — output VAT is due in that period, not at project completion.</li>
      </ul>
      <p>
        Details and worked examples: <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">VAT on interior design services</Link>.
      </p>

      <h2>Professional registration</h2>
      <ul>
        <li><strong>Regulation:</strong> interior design is not a legally regulated profession in South Africa — no licence is required to practise.</li>
        <li><strong>Professional body:</strong> the IID (Institute of Interior Design Professions), with membership categories including Interior Decorator, Interior Design Practitioner (IDP), and Professional Interior Designer (PrID).</li>
        <li><strong>PrID requirements:</strong> a recognised qualification, two or more years of professional experience, and an IID assessment.</li>
      </ul>

      <h2>Cost of starting and running a studio (2026)</h2>
      <ul>
        <li><strong>CIPC company registration:</strong> approximately R500.</li>
        <li><strong>Professional logo and brand identity:</strong> R2,000–R8,000.</li>
        <li><strong>Basic website:</strong> R3,000–R10,000 (or DIY on a website builder).</li>
        <li><strong>Quoting and business software:</strong> from R699/month (QuotingHub Solo) to R2,499/month (Agency); international alternatives typically run the equivalent of roughly R900–R2,700/month at current exchange rates, subject to currency movement.</li>
        <li><strong>Total minimum professional setup:</strong> under R20,000 in initial costs for most new studios.</li>
      </ul>
      <p>
        The full startup walkthrough: <Link href="/blog/how-to-start-interior-design-business-south-africa" className="text-[#9A7B4F] hover:underline">how to start an interior design business in SA</Link>.
      </p>

      <h2>Operational benchmarks</h2>
      <ul>
        <li><strong>Spreadsheet tipping point:</strong> studios typically outgrow Excel-based quoting at 5–8 quotes per month.</li>
        <li><strong>Quote build time:</strong> 1–3 hours per quote in Excel versus minutes in dedicated software once price lists are loaded.</li>
        <li><strong>Typical local made-to-order furniture lead time:</strong> 4–8 weeks; imported furniture commonly 8–16+ weeks including shipping and customs.</li>
        <li><strong>Software setup time:</strong> 1–2 hours for most studios (branding, VAT details, supplier price lists).</li>
      </ul>

      <h2>Using these figures</h2>
      <p>
        These numbers reflect standard practice across the South African interior design industry as published and maintained by QuotingHub, the SA-built quoting platform for designers. You are welcome to cite or link to this page; where ranges are given, individual studios and suppliers vary, and rates in Cape Town, Johannesburg, and Pretoria typically sit above those in smaller centres. This page is reviewed as figures change — rate ranges were last reviewed in July 2026.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>How much does an interior designer cost in South Africa in 2026?</h3>
      <p>
        Typical hourly rates run R800–R1,500 for mid-level designers and R1,500–R2,500+ for senior designers, or 10–15% of project budget on a percentage model. Most designers additionally apply a 15–30% markup on items procured for the client.
      </p>

      <h3>Is interior design a regulated profession in South Africa?</h3>
      <p>
        No — no licence or registration is legally required to practise. The IID provides voluntary professional registration, which functions as a credibility signal, particularly for commercial and corporate work.
      </p>

      <h3>What deposit do interior designers take in South Africa?</h3>
      <p>
        50% upfront is standard before any items are ordered, with higher splits (60/40, 70/30) on projects heavy in custom, non-refundable items.
      </p>

      <div className="cta-block">
        <p className="cta-heading">The platform behind the numbers.</p>
        <p className="cta-body">QuotingHub is the SA-built quoting, invoicing, and purchase order system for interior designers. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
