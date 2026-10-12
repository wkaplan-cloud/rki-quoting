import Link from 'next/link'

const SARS_BUDGET_FAQ = 'https://www.sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/'

export default function VatThreshold2026() {
  return (
    <article className="prose-content">
      <p className="lead">
        From 1 April 2026, you only have to register for VAT once your taxable supplies pass R2.3 million a year. Until then, the limit was R1 million. If your studio turns over between R1 million and R2.3 million, you now have a choice to make. This guide explains what changed, how the numbers work out for residential and commercial clients, and what deregistering involves.
      </p>

      <h2>What changed on 1 April 2026</h2>
      <ul>
        <li><strong>Compulsory registration:</strong> required once taxable supplies exceed <strong>R2.3 million</strong> a year, up from R1 million.</li>
        <li><strong>Voluntary registration:</strong> available once taxable supplies exceed <strong>R120,000</strong> a year, up from R50,000.</li>
        <li><strong>Turnover tax:</strong> the turnover limit for this simplified small-business regime also rose to R2.3 million, up from R1 million.</li>
        <li><strong>The VAT rate</strong> stays at 15%.</li>
      </ul>
      <p>
        Source: <a href={SARS_BUDGET_FAQ} target="_blank" rel="noopener noreferrer" className="text-[#9A7B4F] hover:underline">SARS Budget 2026 FAQ</a>. When SARS published that FAQ, the changes had been announced as effective from 1 April 2026 but had not yet been promulgated, so check the current position with SARS or your accountant.
      </p>

      <h2>Who this affects</h2>
      <ul>
        <li><strong>Studios not yet registered, turning over between R1 million and R2.3 million:</strong> you no longer have to register. You can still choose to.</li>
        <li><strong>Registered studios turning over less than R2.3 million:</strong> you may apply to deregister, but you don&apos;t have to.</li>
        <li><strong>Registered studios turning over less than R120,000:</strong> SARS says it will notify vendors in this position of its intention to cancel their registration.</li>
        <li><strong>Studios over R2.3 million:</strong> nothing changes. You must stay registered.</li>
      </ul>
      <p>
        Remember that turnover includes everything you invoice, not only design fees. For most studios, furniture and fabric bought on the client&apos;s behalf is the bulk of it.
      </p>

      <h2>The numbers: registered vs not registered</h2>
      <p>
        Take one item with a supplier cost of R100,000 excluding VAT, sold with a 30% markup, plus a R50,000 design fee. Your profit on the item is R30,000 either way.
      </p>

      <h3>If you are VAT registered</h3>
      <ul>
        <li>You pay the supplier R115,000 and claim back the R15,000 VAT.</li>
        <li>You charge R130,000 plus VAT, so the client pays R149,500.</li>
        <li>You pay SARS the difference: R19,500 output VAT less R15,000 input VAT, which is R4,500.</li>
        <li>The design fee is R50,000 plus VAT: R57,500.</li>
      </ul>

      <h3>If you are not registered</h3>
      <ul>
        <li>You pay the supplier R115,000 and cannot claim the VAT back, so it becomes part of your cost.</li>
        <li>To keep your R30,000 profit, you charge R145,000, with no VAT added.</li>
        <li>The design fee is R50,000.</li>
      </ul>

      <h3>What it means for each kind of client</h3>
      <p>
        <strong>Residential clients</strong> can&apos;t claim VAT back. If you are not registered, they pay R4,500 less on the item (the VAT that would have been charged on your markup) and R7,500 less on the fee. That makes your pricing more competitive.
      </p>
      <p>
        <strong>Commercial clients that are VAT registered</strong> claim back the VAT you charge. From a registered designer, the item really costs them R130,000. From an unregistered one, it costs R145,000, with nothing to claim. A studio that mostly does commercial work may therefore be better off staying registered.
      </p>
      <p>
        This is a simplified example. Your real position depends on your client mix, your margins, how much of your turnover is design fees, and whether you expect to pass R2.3 million soon.
      </p>

      <h2>What deregistering involves</h2>
      <ul>
        <li><strong>How to apply:</strong> complete a VAT123e form addressed to the SARS branch where you are registered, email a cancellation request, or book a virtual appointment (&quot;VAT and PAYE registration/deregistration&quot;).</li>
        <li><strong>Exit VAT:</strong> on deregistration you must account for VAT on goods and assets you keep that you claimed input VAT on, such as equipment, samples or stock. It is calculated on the lower of cost or open market value, and SARS allows it to be paid in six equal monthly instalments.</li>
        <li><strong>After deregistering:</strong> stop charging VAT, stop issuing tax invoices, and take your VAT number off your quotes, invoices and email signature.</li>
        <li><strong>Watch your turnover:</strong> you must register again within 21 days once you pass R2.3 million, or once you expect to within the next 12 months.</li>
      </ul>
      <p>
        Source for the process and exit VAT: <a href={SARS_BUDGET_FAQ} target="_blank" rel="noopener noreferrer" className="text-[#9A7B4F] hover:underline">SARS Budget 2026 FAQ</a>. This article is general information, not tax advice. Speak to your accountant before deciding.
      </p>

      <h2>Before you decide</h2>
      <ol>
        <li>Add up your taxable turnover for the last 12 months, including procurement, and your forecast for the next 12.</li>
        <li>Split your clients into residential and VAT-registered commercial.</li>
        <li>List the assets you claimed input VAT on, and estimate the exit VAT.</li>
        <li>Re-price one typical recent project both ways, using the example above.</li>
        <li>Take the numbers to your accountant.</li>
      </ol>
      <p>
        For how VAT works on deposits, design fees and procured goods, see our <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">VAT guide for interior designers</Link>.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>What is the VAT registration threshold in South Africa in 2026?</h3>
      <p>
        From 1 April 2026, registration is compulsory once taxable supplies exceed R2.3 million a year, and voluntary registration is available above R120,000.
      </p>

      <h3>Can I deregister if my turnover is under R2.3 million?</h3>
      <p>
        Yes, you may apply. You will have to account for exit VAT on goods and assets you claimed input VAT on, which SARS allows to be paid in six monthly instalments.
      </p>

      <h3>Is it cheaper for clients if I am not VAT registered?</h3>
      <p>
        For residential clients, usually yes, because they don&apos;t pay VAT on your fee and markup. VAT-registered commercial clients can claim VAT back, so for them a registered designer is often cheaper.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Quotes that get VAT right.</p>
        <p className="cta-body">QuotingHub adds 15% VAT, design fees and deposits to every quote and invoice for you. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
