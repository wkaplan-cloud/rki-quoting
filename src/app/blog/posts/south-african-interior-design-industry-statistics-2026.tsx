import Link from 'next/link'
import type { ReactNode } from 'react'

const SOURCES = {
  sarsBudget: 'https://www.sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/',
  sarsVat: 'https://www.sars.gov.za/types-of-tax/value-added-tax/',
  iid: 'https://iidprofessions.org.za/join-the-iid/',
  bizportal: 'https://www.bizportal.gov.za/',
}

function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9A7B4F] hover:underline">
      {children}
    </a>
  )
}

export default function IndustryStatistics() {
  return (
    <article className="prose-content">
      <p className="lead">
        The key numbers for running an interior design studio in South Africa in 2026: tax and registration figures, what designers typically charge, standard commercial terms, and setup costs. Each figure is marked as either <strong>sourced</strong>, with a link to the official source, or a <strong>QuotingHub estimate</strong>, with an explanation of where it comes from.
      </p>

      <h2>How this page is put together</h2>
      <p>
        <strong>Sourced figures</strong> come from SARS, CIPC/BizPortal, legislation, or the IID, and are linked where they appear. Check them against the source before relying on them for compliance decisions.
      </p>
      <p>
        <strong>QuotingHub estimates</strong> are our team&apos;s editorial view of typical practice in the South African trade. They are not the results of a survey, and we have not measured them across a defined sample of studios. Treat them as a starting point and test them against your own market and suppliers.
      </p>

      <h2>Tax and compliance (sourced)</h2>
      <ul>
        <li><strong>VAT rate:</strong> 15% (<Src href={SOURCES.sarsVat}>SARS: Value-Added Tax</Src>).</li>
        <li><strong>Compulsory VAT registration:</strong> taxable supplies above R2.3 million in a 12-month period, raised from R1 million with effect from 1 April 2026 (<Src href={SOURCES.sarsBudget}>SARS Budget 2026 FAQ</Src>). Registration is also required if you reasonably expect to cross the threshold within the next 12 months, and the application is due within 21 days (VAT Act 89 of 1991, s23).</li>
        <li><strong>Voluntary VAT registration:</strong> available once taxable supplies exceed R120,000 a year, raised from R50,000 on 1 April 2026 (<Src href={SOURCES.sarsBudget}>SARS Budget 2026 FAQ</Src>).</li>
        <li><strong>Full tax invoice:</strong> required where the consideration exceeds R5,000, including the recipient&apos;s details (VAT Act s20(4)).</li>
        <li><strong>Deposits:</strong> the time of supply is the earlier of issuing an invoice or receiving any payment, so a deposit received by a VAT vendor generally triggers output VAT in that period (VAT Act s9(1)).</li>
      </ul>
      <p>
        Details and worked examples: <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">VAT on interior design services</Link>.
      </p>

      <h2>Registration and professional bodies (sourced)</h2>
      <ul>
        <li><strong>Company registration:</strong> CIPC charges R50 to reserve a name and R125 to register a private company, or R175 when registering with a name in one step (<Src href={SOURCES.bizportal}>BizPortal</Src>).</li>
        <li><strong>Professional body:</strong> the IID (Institute of Interior Design Professions) offers Student, Designer/Professional, Candidate, Corporate, Educational and Interior Design Agency membership (<Src href={SOURCES.iid}>IID: Join the IID</Src>). Membership is voluntary. We are not aware of any statutory licence required to practise interior design or decorating in South Africa.</li>
      </ul>

      <h2>What SA interior designers charge (QuotingHub estimates)</h2>
      <ul>
        <li><strong>Hourly rates:</strong> about R400–R800/hour for junior designers, R800–R1,500 for mid-level, and R1,500–R2,500+ for senior and specialist designers. Rates in Cape Town, Johannesburg and Pretoria tend to sit above smaller centres.</li>
        <li><strong>Percentage fees:</strong> commonly 10–15% of project budget on residential work.</li>
        <li><strong>Procurement markup:</strong> 15–30% on supplier net prices, with 20% a common figure.</li>
        <li><strong>Trade discounts from suppliers:</strong> commonly 10–30% off retail, varying by supplier and category.</li>
      </ul>
      <p>
        How to choose between models: <Link href="/blog/interior-design-fee-structure-south-africa" className="text-[#9A7B4F] hover:underline">SA fee structure guide</Link>.
      </p>

      <h2>Commercial terms (QuotingHub estimates)</h2>
      <ul>
        <li><strong>Deposit:</strong> 50% upfront is common, with 60/40 and 70/30 splits on projects with many custom items.</li>
        <li><strong>Quotation validity:</strong> 30 days is typical; 45–60 days is sometimes offered on large commercial work.</li>
        <li><strong>Final invoice terms:</strong> commonly 7 days residential, up to 30 days commercial.</li>
        <li><strong>Custom items:</strong> made-to-order and cut goods are usually non-cancellable once ordered. Check each supplier&apos;s terms.</li>
        <li><strong>Lead times:</strong> roughly 4–8 weeks for local made-to-order furniture, and 8–16+ weeks for imported furniture including shipping and customs.</li>
      </ul>

      <h2>Cost of starting a studio (mixed)</h2>
      <ul>
        <li><strong>CIPC registration:</strong> under R200 in official fees (sourced, above).</li>
        <li><strong>Logo and brand identity:</strong> R2,000–R8,000 (estimate).</li>
        <li><strong>Basic website:</strong> R3,000–R10,000, or DIY on a website builder (estimate).</li>
        <li><strong>Quoting software:</strong> QuotingHub is R699/month (Solo) to R2,499/month (Agency), per our <Link href="/pricing" className="text-[#9A7B4F] hover:underline">pricing page</Link>. International tools are priced in foreign currency, so their rand cost moves with the exchange rate.</li>
      </ul>
      <p>
        The full startup walkthrough: <Link href="/blog/how-to-start-interior-design-business-south-africa" className="text-[#9A7B4F] hover:underline">how to start an interior design business in SA</Link>.
      </p>

      <h2>Corrections</h2>
      <p>
        On 11 October 2026 we updated the VAT thresholds to the figures in force from 1 April 2026, corrected the CIPC fees, removed membership designations we could not confirm on the IID website, and labelled every unsourced figure as an estimate. If you spot an error, <Link href="/#contact" className="text-[#9A7B4F] hover:underline">tell us</Link>.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>When must an interior designer register for VAT in South Africa?</h3>
      <p>
        Once taxable supplies exceed R2.3 million in a 12-month period, or are expected to, under the threshold in force from 1 April 2026. Voluntary registration is available above R120,000 a year.
      </p>

      <h3>How much does an interior designer cost in South Africa in 2026?</h3>
      <p>
        By our estimate, mid-level designers charge around R800–R1,500 an hour and senior designers R1,500–R2,500+, or 10–15% of the project budget on a percentage model. Most also mark up items they procure, commonly by 15–30%.
      </p>

      <h3>Is interior design a regulated profession in South Africa?</h3>
      <p>
        We are not aware of any statutory licence requirement. The IID offers voluntary membership, which many designers use as a credibility signal, particularly for commercial work.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Quote with these numbers built in.</p>
        <p className="cta-body">QuotingHub is the SA-built quoting, invoicing and purchase order system for interior designers. It handles VAT, deposits and markups for you. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
