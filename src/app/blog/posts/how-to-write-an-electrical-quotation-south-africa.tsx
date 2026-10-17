import Link from 'next/link'

export default function HowToWriteElectricalQuotationSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        A good electrical quotation tells the client exactly what they are paying for, protects you when material prices move, and sets up how you will be paid. This guide covers what to put on an electrical quote in South Africa, how to price it, and how to handle VAT, deposits and the COC.
      </p>

      <h2>What to include on an electrical quotation</h2>

      <h3>1. Your business details</h3>
      <p>
        Trading name, registration number, physical address, contact details and, if you are a VAT vendor, your VAT number. If you are a registered electrical contractor, show your registration details too — clients and main contractors increasingly ask for them.
      </p>

      <h3>2. Client and site details</h3>
      <p>The client&apos;s name, billing details and VAT number (for commercial clients), and the site address if it differs from the billing address.</p>

      <h3>3. Quote number, date and validity</h3>
      <p>
        Number every quote so it can be matched to the order, the claims and the invoice later. Show a validity date on the face of the quote. Because cable and copper prices move often, many contractors keep validity short — 14 to 30 days — and say that prices may be adjusted after that.
      </p>

      <h3>4. Scope of work</h3>
      <p>
        Describe the work in plain language: what is being installed, where, and to what standard. Break larger jobs into sections — for example DB board, lighting, power points, outside lights, data — so the client can see where the money goes.
      </p>

      <h3>5. Itemised materials, labour and preliminaries</h3>
      <ul>
        <li><strong>Materials:</strong> each item with a quantity, unit and price — cable by the metre, plugs and switches by the unit, DB components, conduit.</li>
        <li><strong>Labour:</strong> hours or a fixed amount per section.</li>
        <li><strong>Preliminaries:</strong> site setup, travel, access equipment, waste removal.</li>
        <li><strong>COC and testing:</strong> show the inspection and certificate as its own line so the client knows it is included.</li>
      </ul>

      <h3>6. Exclusions and assumptions</h3>
      <p>
        Say what is not included: builder&apos;s work such as chasing and making good, fittings supplied by the client, municipal or Eskom connection fees, and work behind walls you could not inspect. Clear exclusions prevent most disputes.
      </p>

      <h3>7. Payment terms</h3>
      <p>
        State the deposit (often to cover materials), how progress payments work on larger jobs, and when the balance is due. On projects, monthly progress claims against the quoted lines are normal.
      </p>

      <h3>8. Variations</h3>
      <p>
        Explain that any change to the scope will be quoted as a variation order and needs the client&apos;s written approval before the work is done.
      </p>

      <h3>9. Acceptance</h3>
      <p>A signature and date line, or an online acceptance, so you have a clear record of what was agreed.</p>

      <h2>VAT on electrical quotations</h2>
      <p>
        South African VAT is 15%. If you are a VAT vendor, show amounts excluding VAT, the VAT, and the total. From 1 April 2026 VAT registration is compulsory once taxable supplies exceed R2.3 million a year. If you are not registered, do not add VAT, and state on the quote that you are not a VAT vendor.
      </p>

      <h2>The Certificate of Compliance (COC)</h2>
      <p>
        Under the Electrical Installation Regulations, 2009, a registered person must issue a COC for new electrical installations and for alterations, with testing done in line with SANS 10142-1. Property sellers also need a valid COC for the electrical installation before transfer. Linking the COC to the quote and the job means the certificate, test results and the work it covers are kept together.
      </p>

      <h2>Common mistakes</h2>
      <ol>
        <li><strong>One-line quotes</strong> like &quot;Rewire house — R45,000&quot;. The client can&apos;t compare them and you can&apos;t defend them.</li>
        <li><strong>No validity date</strong>, so you are held to old cable prices months later.</li>
        <li><strong>No exclusions</strong>, so every surprise behind a wall becomes your cost.</li>
        <li><strong>Doing extra work on a verbal OK</strong> instead of a signed variation order.</li>
        <li><strong>Spreadsheet errors</strong> — broken VAT formulas and wrong totals when rows are copied.</li>
      </ol>

      <h2>Quote faster with software</h2>
      <p>
        QuotingHub&apos;s electrician product builds quotes in sections with materials, labour and preliminaries, sends them as a branded PDF, then uses the same lines for monthly progress claims, variation orders and the digital SANS 10142-1 COC. See <Link href="/trades/electrician" className="text-[#9A7B4F] hover:underline">QuotingHub for electricians</Link>, or compare the options in <Link href="/blog/best-quoting-software-for-electricians-south-africa" className="text-[#9A7B4F] hover:underline">the best quoting software for electricians in South Africa</Link>.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Send your next quote from QuotingHub</p>
        <p className="cta-body">30-day free trial. No credit card required.</p>
        <Link href="/supplier-portal/register?type=trades" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
