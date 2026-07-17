import Link from 'next/link'

export default function TradeAccounts() {
  return (
    <article className="prose-content">
      <p className="lead">
        Trade accounts are how interior designers in South Africa actually make procurement profitable: suppliers sell to you at trade prices, you sell to your client at retail with your markup, and the difference funds your studio. But suppliers do not hand trade terms to anyone with a business card. Here is how trade accounts work in SA, what suppliers look for, and how to apply properly.
      </p>

      <h2>What a trade account actually is</h2>
      <p>
        A trade account is a registered relationship with a supplier — a fabric house, furniture manufacturer, or lighting importer — that gives you access to trade pricing below retail. Depending on the supplier, the discount off retail commonly falls somewhere between 10% and 30%, and some fabric houses work on trade-only price lists that are never published at retail at all. Combined with your own markup, this is the procurement margin that our <Link href="/blog/interior-design-fee-structure-south-africa" className="text-[#9A7B4F] hover:underline">fee structure guide</Link> describes as a core revenue stream for SA studios.
      </p>

      <h2>What SA suppliers typically ask for</h2>
      <p>
        Requirements vary by supplier, but the standard checklist looks like this:
      </p>
      <ul>
        <li><strong>A registered business</strong> — your CIPC registration (or at minimum a trading name and proof you operate commercially).</li>
        <li><strong>Evidence you are in the trade</strong> — a website, portfolio, Instagram presence with real projects, or IID membership. Suppliers want to know you resell to clients, not shop for your own house.</li>
        <li><strong>Your VAT number</strong>, if registered — not always required, but it strengthens the application and matters for their invoicing.</li>
        <li><strong>Completed credit application or trade form</strong> — most established suppliers have a standard form; some ask for trade references from other suppliers once you have them.</li>
        <li><strong>A first order</strong> — some suppliers activate trade terms from the first genuine order rather than on paperwork alone.</li>
      </ul>

      <h2>How to apply: a five-step process</h2>
      <ul>
        <li><strong>1. Build your list.</strong> Identify the 8–12 suppliers your style of work actually needs — fabric houses, furniture makers, lighting, rugs. Our <Link href="/blog/best-fabric-and-furniture-suppliers-for-interior-designers-south-africa" className="text-[#9A7B4F] hover:underline">SA supplier guide</Link> is a starting point.</li>
        <li><strong>2. Get your credentials in order first.</strong> A one-page studio profile: logo, CIPC number, VAT number if you have one, website, and three project images. Applications with a professional profile get processed faster and taken more seriously.</li>
        <li><strong>3. Contact the trade or sales rep, not the showroom counter.</strong> Ask for the trade application form and their current terms. Showroom visits help — reps remember faces, and in the SA industry relationships genuinely move your service level.</li>
        <li><strong>4. Complete the form properly.</strong> Half-completed credit applications sit in inboxes. Include references when asked, and be honest about being a new studio — most suppliers have a path for new designers, often cash-before-delivery at trade prices initially, moving to account terms later.</li>
        <li><strong>5. Place a clean first order.</strong> A formal purchase order with your business details, clear item codes, and prompt payment. Your first few orders set your reputation with that supplier permanently.</li>
      </ul>

      <h2>Keeping trade accounts healthy</h2>
      <ul>
        <li><strong>Always order on a formal PO.</strong> It prevents item and colourway errors, and it keeps a paper trail for SARS. See <Link href="/blog/purchase-orders-for-interior-designers-south-africa" className="text-[#9A7B4F] hover:underline">our complete PO guide</Link>.</li>
        <li><strong>Pay on time, every time.</strong> The SA design supplier world is small and reps talk. Payment reliability is the single biggest factor in the service, stock allocations, and flexibility you get.</li>
        <li><strong>Never expose trade prices to clients.</strong> Your client documents show your selling prices; your supplier documents show net trade prices. Keeping these separated by system — not by carefulness — is exactly why QuotingHub generates client quotes and supplier POs as separate documents from the same project.</li>
        <li><strong>Confirm current pricing before quoting.</strong> Trade price lists change, especially on imported goods. Quoting from a stale price list is a direct margin loss — load updated supplier price lists into your quoting system as they arrive.</li>
      </ul>

      <h2>Trade discounts and your markup: how the numbers stack</h2>
      <p>
        Suppose a fabric retails at R1,000/metre and your trade price is R750. You might quote the client R950 — below retail, so the client sees value, while you earn R200/metre on top of your design fee. This double structure (trade discount plus designer markup) is standard practice in SA, and it is why serious procurement volume through trade accounts often out-earns the design fee itself on furnishing-heavy projects.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>Can a new interior designer without clients get trade accounts in South Africa?</h3>
      <p>
        Yes — most SA suppliers accept new designers who present professionally: a registered business, a portfolio or credible online presence (student and show-house work counts), and a completed application. You may start on cash-with-order terms at trade pricing, with credit terms following once a payment history exists.
      </p>

      <h3>What trade discount do SA suppliers give interior designers?</h3>
      <p>
        Commonly between 10% and 30% off retail depending on the supplier and category, and some trade-only suppliers price exclusively for the trade. Terms are confidential between you and each supplier — always confirm current terms directly rather than relying on published figures.
      </p>

      <h3>Do I need to be VAT registered to open a trade account?</h3>
      <p>
        Usually no — a registered business and evidence you work in the industry is typically enough. A VAT number strengthens the application, and once your turnover approaches R1 million registration becomes compulsory anyway. See our <Link href="/blog/vat-on-interior-design-services-south-africa" className="text-[#9A7B4F] hover:underline">VAT guide for designers</Link>.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Keep trade prices and client prices separated — by design.</p>
        <p className="cta-body">QuotingHub stores supplier price lists, applies your markup on client quotes, and generates net-price purchase orders per supplier. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
