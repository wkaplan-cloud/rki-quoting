import Link from 'next/link'

export default function JobberVsQuotingHubSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        Jobber is one of the best-known field service apps in the world, built mainly for home service businesses in North America. QuotingHub is built in South Africa for electrical contractors and for home automation, AV and CCTV installers. Both quote, schedule and invoice. Here is where they differ for a South African business.
      </p>

      <h2>Quick summary</h2>
      <ul>
        <li><strong>Choose Jobber</strong> if you run recurring service work (maintenance rounds, callouts), want a polished client booking and payment experience, and keep your books in QuickBooks Online or Xero.</li>
        <li><strong>Choose QuotingHub</strong> if you quote projects in sections, claim monthly, issue COCs, need variation orders signed off, or keep your books in Sage.</li>
      </ul>

      <h2>Pricing</h2>
      <p>
        <strong>Jobber</strong> sells tiered plans priced in US dollars. Each tier includes a set number of users, and larger teams pay for extra seats or move up a tier, so the cost rises with headcount and the exchange rate. Check Jobber&apos;s pricing page for current figures.
      </p>
      <p>
        <strong>QuotingHub</strong> charges per business in rand, with up to 20 staff included: R999, R1,999 or R3,199 a month for electricians, and R2,999 or R4,499 for installers. Extra staff are R40/month each. Every plan has a 30-day free trial and no contract.
      </p>

      <h2>Accounting integration</h2>
      <p>
        Jobber&apos;s accounting integrations are QuickBooks Online and Xero. QuotingHub&apos;s trades products push invoices and claims to Sage Business Cloud Accounting, which many South African contractors already use.
      </p>

      <h2>South African requirements</h2>
      <ul>
        <li><strong>COC:</strong> QuotingHub includes a digital Certificate of Compliance that captures SANS 10142-1 information and test results and links it to the job. Jobber is a general field service app and has no South African COC.</li>
        <li><strong>VAT and rand:</strong> QuotingHub prices in rand and adds 15% VAT by default. Jobber can be configured for tax, but it is built around US and Canadian businesses.</li>
      </ul>

      <h2>Projects, claims and variations</h2>
      <p>
        Jobber is strongest on quote → schedule → invoice for service jobs. QuotingHub adds the contracting side: quotes built in sections (materials, labour, preliminaries), monthly progress claims by percentage complete, and variation orders tracked against the original value and approved by the client online.
      </p>

      <h2>Where Jobber is stronger</h2>
      <ul>
        <li>A large, mature product with a big user base and many integrations.</li>
        <li>Polished client-facing features for booking, reminders and online payment.</li>
        <li>Suits many home service trades beyond electrical and installation work.</li>
      </ul>

      <h2>Verdict</h2>
      <p>
        For a South African electrical contractor who quotes projects, claims monthly and issues COCs, QuotingHub covers more of the job and costs the same whether you have five staff or twenty. For a service-only business on QuickBooks or Xero that wants a well-known general app, Jobber is a solid choice.
      </p>
      <p>
        See <Link href="/trades/electrician" className="text-[#9A7B4F] hover:underline">QuotingHub for electricians</Link>, <Link href="/blog/servicem8-vs-quotinghub-south-africa" className="text-[#9A7B4F] hover:underline">ServiceM8 vs QuotingHub</Link>, <Link href="/blog/tradify-vs-quotinghub-south-africa" className="text-[#9A7B4F] hover:underline">Tradify vs QuotingHub</Link>, or the wider comparison of <Link href="/blog/best-quoting-software-for-electricians-south-africa" className="text-[#9A7B4F] hover:underline">quoting software for electricians in South Africa</Link>.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Compare for yourself</p>
        <p className="cta-body">QuotingHub is free for 30 days. No credit card required.</p>
        <Link href="/supplier-portal/register?type=trades" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
