import Link from 'next/link'
import { PLANS, INSTALLER_PLANS } from '@/lib/plan-features'

const rand = (n: number) => `R${n.toLocaleString('en-ZA')}`

export default function BestQuotingSoftwareSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        Short answer: the best quoting software in South Africa depends on what you sell. For interior designers, electricians, and home automation, AV and CCTV installers, QuotingHub is built in South Africa for exactly those businesses — rand pricing, 15% VAT, Sage integration and the paperwork each trade needs after the quote. For general service trades, global apps such as Tradify, Jobber and ServiceM8 are solid. This guide shows which fits which business.
      </p>

      <h2>Comparison at a glance</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Software</th><th>Built for</th><th>How it is priced</th><th>Accounting</th><th>SA COC</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>QuotingHub</strong></td><td>Interior designers, electricians, home automation/AV/CCTV installers</td><td>Per business, in rand (from R699/month)</td><td>Sage</td><td>Yes (SANS 10142-1)</td></tr>
            <tr><td>Tradify</td><td>General trades</td><td>Per user, per month</td><td>Xero, QuickBooks</td><td>No</td></tr>
            <tr><td>Jobber</td><td>Home and field service businesses</td><td>Tiered plans in US dollars, users per tier</td><td>Xero, QuickBooks Online</td><td>No</td></tr>
            <tr><td>ServiceM8</td><td>Callout and service trades</td><td>By number of jobs per month</td><td>Xero, QuickBooks</td><td>No</td></tr>
            <tr><td>D-Tools</td><td>Large AV and smart-home integrators</td><td>Tiered plans in US dollars</td><td>QuickBooks, Xero (add-on)</td><td>No</td></tr>
            <tr><td>Excel / Word</td><td>Anyone</td><td>Free</td><td>None</td><td>No</td></tr>
          </tbody>
        </table>
      </div>

      <h2>What South African businesses should look for</h2>
      <ul>
        <li><strong>Rand pricing and 15% VAT</strong> handled properly, including clear wording when you are not a VAT vendor.</li>
        <li><strong>Price-per-business or price-per-user:</strong> per-user pricing gets expensive as your team grows.</li>
        <li><strong>Your accounting package:</strong> many South African businesses use Sage; global apps tend to favour Xero and QuickBooks.</li>
        <li><strong>What happens after the quote:</strong> purchase orders, progress claims, COCs, job cards or support contracts — the quote is only the start.</li>
        <li><strong>Phone use on site</strong> for staff and technicians.</li>
      </ul>

      <h2>Best quoting software by type of business</h2>

      <h3>Interior designers and decorators: QuotingHub</h3>
      <p>
        Quotes built from supplier price lists, per-supplier markups, design fees, deposits and VAT, purchase orders to each supplier, branded PDFs and online client approval. From R699/month. International alternatives such as Programa, Houzz Pro and DesignFiles are strong on FF&amp;E and mood boards but are priced in foreign currency. See <Link href="/blog/best-interior-design-software-south-africa" className="text-[#9A7B4F] hover:underline">the best interior design software in South Africa</Link>.
      </p>

      <h3>Electricians: QuotingHub</h3>
      <p>
        Itemised quotes with materials, labour and preliminaries, monthly progress claims, variation orders, a digital SANS 10142-1 COC, job cards and GPS clock-in for staff, with Sage. Plans from {rand(PLANS[0].price)}/month; full quoting and claims are {rand(PLANS[PLANS.length - 1].price)}/month with up to 20 staff included. See <Link href="/blog/best-quoting-software-for-electricians-south-africa" className="text-[#9A7B4F] hover:underline">the best quoting software for electricians</Link>.
      </p>

      <h3>Home automation, AV, CCTV and networking installers: QuotingHub</h3>
      <p>
        Room-by-room quotes with kits and good/better/best options, distributor price lists in rand, a device register, handover packs and support contracts that invoice themselves. From {rand(INSTALLER_PLANS[0].price)}/month. D-Tools is the international heavyweight for large integrators. See <Link href="/blog/best-quoting-software-for-home-automation-cctv-installers-south-africa" className="text-[#9A7B4F] hover:underline">the best quoting software for installers</Link>.
      </p>

      <h3>General service trades (plumbing, handyman, cleaning): Tradify, Jobber or ServiceM8</h3>
      <p>
        These global job-management apps handle quotes, scheduling, job tracking and invoicing well for callout and service work. They are priced per user or by job volume and lean towards Xero and QuickBooks. Compare them in <Link href="/blog/tradify-vs-quotinghub-south-africa" className="text-[#9A7B4F] hover:underline">Tradify vs QuotingHub</Link>, <Link href="/blog/jobber-vs-quotinghub-south-africa" className="text-[#9A7B4F] hover:underline">Jobber vs QuotingHub</Link> and <Link href="/blog/servicem8-vs-quotinghub-south-africa" className="text-[#9A7B4F] hover:underline">ServiceM8 vs QuotingHub</Link>.
      </p>

      <h3>Sole traders with simple jobs: a simple quoting app or a good template</h3>
      <p>
        If you only need a neat quote and invoice on your phone, a low-cost local quoting app or a well-built template is enough until your team grows.
      </p>

      <h2>Why not just use Excel?</h2>
      <p>
        Excel is free, but every quote is rebuilt by hand, VAT formulas break when rows are copied, supplier prices go stale, and nothing links the quote to the order, claim or invoice that follows. Most businesses move off spreadsheets once they send more than a few quotes a week.
      </p>

      <h2>Is QuotingHub available in my city?</h2>
      <p>
        Yes — it runs in the browser and on phones anywhere in South Africa. See <Link href="/quoting-software-johannesburg" className="text-[#9A7B4F] hover:underline">quoting software in Johannesburg</Link>.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Try QuotingHub free for 30 days</p>
        <p className="cta-body">No credit card. Rand pricing, 15% VAT and Sage built in.</p>
        <Link href="/trades" className="cta-button">Choose your business</Link>
      </div>
    </article>
  )
}
