import Link from 'next/link'

export default function SupplierLeadTimes() {
  return (
    <article className="prose-content">
      <p className="lead">
        Nothing damages a client relationship faster than a promised installation date sliding by two months because a sofa is stuck at port. In South Africa — where much of what designers specify is imported, made to order, or both — lead time management is not admin, it is a core professional skill. Here is how experienced SA studios manage it.
      </p>

      <h2>What lead times actually look like in SA</h2>
      <p>
        Rough working ranges (always confirm per item, per supplier — these shift with demand, factories, and shipping):
      </p>
      <ul>
        <li><strong>In-stock local items:</strong> a few days to 2 weeks.</li>
        <li><strong>Locally made-to-order furniture and upholstery:</strong> commonly 4–8 weeks, longer in peak season or for complex pieces.</li>
        <li><strong>Cut-length fabric from local stock:</strong> days — but if the mill must weave, months.</li>
        <li><strong>Imported furniture and lighting:</strong> commonly 8–16 weeks or more once manufacture, sea freight, port handling, and customs are added — and port delays are a recurring SA reality.</li>
      </ul>
      <p>
        The compounding problem: a single room typically mixes all four categories, and the installation can only happen when the slowest item lands.
      </p>

      <h2>The rules that keep projects on time</h2>

      <h3>1. Confirm lead times in writing, on the purchase order</h3>
      <p>
        A verbal &quot;about six weeks&quot; from a showroom rep is not a commitment. Put the quoted lead time on the PO itself and ask the supplier to confirm it on acceptance. Now you have a baseline to manage against — and a paper trail when things slip. Our <Link href="/blog/purchase-orders-for-interior-designers-south-africa" className="text-[#9A7B4F] hover:underline">purchase order guide</Link> covers what else belongs on the PO.
      </p>

      <h3>2. Never order before the deposit clears — then order immediately</h3>
      <p>
        The deposit rule protects you financially; the &quot;immediately&quot; half protects the programme. Every day between deposit and PO is a day added to the end date. The studios with the best delivery records place all long-lead POs within 48 hours of the deposit clearing.
      </p>

      <h3>3. Quote clients dates with buffer — and never quote the supplier&apos;s number</h3>
      <p>
        If the supplier says 8 weeks, the client hears 10–12. The buffer absorbs normal slippage, and early delivery makes you look exceptional. Quoting the raw supplier estimate to clients converts every ordinary delay into a broken promise.
      </p>

      <h3>4. Sequence orders by lead time, not by room</h3>
      <p>
        List every item with its lead time and order longest-first, regardless of which room it belongs to. The imported light fitting gets ordered before the locally made scatter cushions, always.
      </p>

      <h3>5. Chase proactively at fixed checkpoints</h3>
      <p>
        Do not wait for the due date to discover a delay. Check in with suppliers at order confirmation, mid-production, pre-shipment, and pre-delivery. A five-minute email at each checkpoint surfaces problems while there is still time to react — resequence the install, source an alternative, or reset client expectations early.
      </p>

      <h3>6. Communicate delays to clients before they ask</h3>
      <p>
        Clients forgive delays they hear about early with a plan attached. They do not forgive silence. &quot;The dining table has moved out two weeks due to a shipping delay; everything else installs as planned on the 14th and the table follows on the 28th&quot; is a professional message that builds trust rather than eroding it.
      </p>

      <h3>7. Protect yourself contractually</h3>
      <p>
        Your agreement should state that lead times are estimates, that supplier and shipping delays extend the programme, and that client-caused delays (late decisions, late payments) do too. Our <Link href="/blog/interior-design-contract-template-south-africa" className="text-[#9A7B4F] hover:underline">contract guide</Link> covers the clause in context.
      </p>

      <h2>Imports: the exchange rate wrinkle</h2>
      <p>
        On imported goods with long lead times, the rand can move meaningfully between quote and supplier invoice. Handle it one of two ways: price the risk into your quote, or include a clause that material exchange-rate movements on unpaid imported items may be passed through. Either is defensible — surprising the client at delivery is not. Quote validity periods (30 days standard) exist for exactly this reason; see <Link href="/blog/how-to-write-interior-design-quotation-south-africa" className="text-[#9A7B4F] hover:underline">how to write an SA quotation</Link>.
      </p>

      <h2>Track it in one place</h2>
      <p>
        Once a project has POs across six suppliers with six different lead times, spreadsheet tracking starts to leak. QuotingHub keeps every supplier PO attached to its project, so you can see per supplier what has been ordered, what it cost, and what is outstanding — the raw material of lead time management — in one view instead of a folder of emails.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>How long do furniture lead times run in South Africa?</h3>
      <p>
        As working ranges: local in-stock items within days to two weeks; locally made-to-order furniture commonly 4–8 weeks; imported furniture commonly 8–16+ weeks including shipping and customs. Always confirm the current lead time per item in writing at order stage — these ranges move with season, factory load, and port conditions.
      </p>

      <h3>Should I tell clients the supplier&apos;s lead time?</h3>
      <p>
        Give clients a buffered date, not the supplier&apos;s raw estimate — typically add 20–30%. The buffer absorbs routine slippage in shipping and production, and delivering early builds far more goodwill than explaining a missed promise.
      </p>

      <h3>Who carries the cost when an imported item is delayed?</h3>
      <p>
        Delay itself usually costs programme time rather than money, and a well-drafted contract makes clear that supplier and shipping delays extend timelines without penalty to you. Exchange-rate movement on unpaid imports is separate — address it explicitly in your quote terms or contract.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Every supplier order, tracked against its project.</p>
        <p className="cta-body">QuotingHub generates per-supplier purchase orders from accepted quotes and keeps them organised by project. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
