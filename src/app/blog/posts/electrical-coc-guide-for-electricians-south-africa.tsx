import Link from 'next/link'

export default function ElectricalCocGuideSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        The electrical Certificate of Compliance (COC) is the document South African electricians issue most often and get questioned about most. This guide covers when a COC is needed, who may issue one, what it must contain, the two-year rule on property sales, and how to keep COCs organised as your business grows.
      </p>

      <h2>What is an electrical COC?</h2>
      <p>
        A COC is the certificate, required by the Electrical Installation Regulations, 2009 (made under the Occupational Health and Safety Act), confirming that an electrical installation has been inspected and tested and complies with SANS 10142-1. It is issued together with a test report recording the results of the inspection and tests.
      </p>

      <h2>When is a COC required?</h2>
      <ul>
        <li><strong>New installations</strong> — once the work is complete and tested.</li>
        <li><strong>Additions and alterations</strong> — a COC is needed for the work done.</li>
        <li><strong>Change of ownership</strong> — under regulation 7(5), the user or lessor may not allow a change of ownership if the COC is older than two years. This is why sellers and estate agents ask for a fresh COC.</li>
        <li><strong>Every user or lessor</strong> of an electrical installation must have a valid COC for it.</li>
      </ul>
      <p>
        Regulation 7(3) exempts installations that existed before 23 October 1992 and have had no change of ownership since 1 March 1994, but any addition or alteration means a COC is needed for the whole installation.
      </p>

      <h2>Who may issue a COC?</h2>
      <p>Only a registered person, registered with the Chief Inspector of the Department of Employment and Labour. There are three categories:</p>
      <ul>
        <li><strong>Electrical tester for single phase</strong> — single-phase installations, excluding specialised installations.</li>
        <li><strong>Installation electrician</strong> — any installation except specialised installations.</li>
        <li><strong>Master installation electrician</strong> — any installation, including specialised installations such as hazardous locations, explosive atmospheres and medical locations.</li>
      </ul>
      <p>
        The registered person must produce their certificate of registration on request to an inspector or to the person they are issuing the COC to, so it is good practice to show the registration number on the COC and the quote.
      </p>

      <h2>What a COC and test report record</h2>
      <ul>
        <li>The installation address and the owner or user.</li>
        <li>The supply details: supply authority, voltage, phases.</li>
        <li>The earthing arrangement.</li>
        <li>Inspection items and test results, such as earth continuity, insulation resistance, earth leakage protection operation and polarity.</li>
        <li>The registered person&apos;s name, registration category and number, signature and date.</li>
        <li>Whether the COC covers the whole installation or only an addition or alteration.</li>
      </ul>

      <h2>Practical tips</h2>
      <ol>
        <li><strong>Quote the COC as its own line.</strong> Clients then see that inspection and testing are part of the price.</li>
        <li><strong>Note defects in writing before quoting repairs.</strong> On a sale COC, list what failed and quote the remedial work separately.</li>
        <li><strong>Keep every COC with its job.</strong> You may need to produce it years later, and the next owner&apos;s electrician may contact you.</li>
        <li><strong>Send a PDF on the day.</strong> Estate agents and conveyancers work to transfer deadlines.</li>
      </ol>

      <h2>Doing COCs digitally</h2>
      <p>
        QuotingHub&apos;s electrician product includes a digital COC that captures the supply, earthing and test results, the tester&apos;s registration details and the client details, then sends a PDF to the client. Each COC is linked to the quote and project it belongs to, so the paperwork for a job stays in one place. See <Link href="/trades/electrician" className="text-[#9A7B4F] hover:underline">QuotingHub for electricians</Link>.
      </p>
      <p>
        This guide summarises the regulations for practical use; check the current Electrical Installation Regulations and SANS 10142-1 for the exact requirements on any job.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Issue your next COC from your phone</p>
        <p className="cta-body">30-day free trial. No credit card required.</p>
        <Link href="/supplier-portal/register?type=trades" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
