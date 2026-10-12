import Link from 'next/link'

export default function MarkupVsMargin() {
  return (
    <article className="prose-content">
      <p className="lead">
        Markup and margin both describe the profit on an item you buy for a client, but they are not the same number. Mixing them up is one of the most common ways a studio underprices procurement. This guide gives the formulas, a conversion table and worked examples in rands, including what VAT, trade discounts and client discounts do to your profit.
      </p>

      <h2>The difference in one example</h2>
      <p>
        You buy a sofa for R20,000 (excluding VAT) and sell it to your client for R26,000 (excluding VAT). Your profit is R6,000.
      </p>
      <ul>
        <li><strong>Markup</strong> is profit as a percentage of <em>cost</em>: R6,000 ÷ R20,000 = <strong>30%</strong>.</li>
        <li><strong>Margin</strong> is profit as a percentage of the <em>selling price</em>: R6,000 ÷ R26,000 = <strong>23.1%</strong>.</li>
      </ul>
      <p>
        Same sofa, same profit, two different percentages. If you want to keep 30% of what the client pays, a 30% markup won&apos;t get you there.
      </p>

      <h2>The formulas</h2>
      <ul>
        <li><strong>Selling price</strong> = cost × (1 + markup)</li>
        <li><strong>Margin</strong> = markup ÷ (1 + markup)</li>
        <li><strong>Markup</strong> = margin ÷ (1 − margin)</li>
        <li><strong>Selling price for a target margin</strong> = cost ÷ (1 − margin)</li>
      </ul>
      <p>
        Example: to make a 30% margin on a R20,000 sofa, sell it for R20,000 ÷ 0.70 = R28,571, which is a 42.9% markup.
      </p>

      <h2>Conversion table</h2>
      <p><strong>Markup → margin</strong></p>
      <ul>
        <li>10% markup = 9.1% margin</li>
        <li>15% markup = 13.0% margin</li>
        <li>20% markup = 16.7% margin</li>
        <li>25% markup = 20.0% margin</li>
        <li>30% markup = 23.1% margin</li>
        <li>35% markup = 25.9% margin</li>
        <li>40% markup = 28.6% margin</li>
        <li>50% markup = 33.3% margin</li>
        <li>100% markup = 50.0% margin</li>
      </ul>
      <p><strong>Margin → markup</strong></p>
      <ul>
        <li>20% margin needs a 25.0% markup</li>
        <li>25% margin needs a 33.3% markup</li>
        <li>30% margin needs a 42.9% markup</li>
        <li>40% margin needs a 66.7% markup</li>
        <li>50% margin needs a 100% markup</li>
      </ul>

      <h2>Where VAT fits</h2>
      <p>
        <strong>If you are VAT registered</strong>, work out your markup on the supplier&apos;s price excluding VAT, then add 15% VAT to your selling price. You claim back the VAT you paid the supplier, so it is not part of your cost. On the sofa: R26,000 plus R3,900 VAT, so the client pays R29,900.
      </p>
      <p>
        <strong>If you are not VAT registered</strong>, the VAT you pay the supplier is a real cost you can&apos;t claim back. Your cost is the price including VAT (R23,000 for the sofa), and your markup goes on top of that. Don&apos;t add VAT to your selling price. For when registration applies, see our guide to the <Link href="/blog/vat-threshold-r2-3-million-interior-designers-2026" className="text-[#9A7B4F] hover:underline">R2.3 million VAT threshold</Link>.
      </p>

      <h2>Trade discounts are not markup</h2>
      <p>
        Many suppliers give designers a trade discount off the retail price. If you buy at 20% off a R10,000 retail price and sell to the client at full retail:
      </p>
      <ul>
        <li>Your cost is R8,000 and your profit is R2,000.</li>
        <li>That is a 25% markup, but a 20% margin.</li>
      </ul>
      <p>
        The trade discount percentage equals your margin when you sell at retail, not your markup. Treat this kind of pricing as a separate decision from your procurement markup, and record which one you&apos;re using on each item.
      </p>

      <h2>Why client discounts hurt more than they look</h2>
      <p>
        Back to the sofa: cost R20,000, selling price R26,000, profit R6,000. If you give the client 10% off the selling price, they pay R23,400 and your profit drops to R3,400. A 10% discount has cut your profit by 43%.
      </p>
      <p>
        Before agreeing to a discount, work out what it does to your rand profit, not just to the client&apos;s total. Offering to drop an item, or to swap it for an alternative, often protects your margin better than a percentage off.
      </p>

      <h2>Choosing your markup</h2>
      <p>
        There is no single right figure. It depends on your design fee model, how much sourcing and admin each item takes, and your overheads. Many studios use different markups by category, for example a lower markup on high-value joinery and a higher one on accessories that take time to source. For fee models, see our <Link href="/blog/interior-design-fee-structure-south-africa" className="text-[#9A7B4F] hover:underline">fee structure guide</Link>.
      </p>
      <p>
        Whatever you choose, look at the margin in rands on each project, not just the markup percentage on each line.
      </p>

      <h2>How QuotingHub handles markup</h2>
      <p>
        Each supplier in QuotingHub has a default markup, which is applied when you add that supplier&apos;s item to a quote. You can change it on any line, and QuotingHub works out the sale price, VAT and totals. Clients see the sale price only. Studio and Agency plans add a markup calculator, a Job Cost Sheet showing cost and profit for each project, and profit analytics by project and year. See the <Link href="/blog/quotinghub-walkthrough-price-list-to-purchase-orders" className="text-[#9A7B4F] hover:underline">product walkthrough</Link> for how a quote is built.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>Is a 30% markup the same as a 30% margin?</h3>
      <p>
        No. A 30% markup gives a 23.1% margin. To make a 30% margin you need a 42.9% markup.
      </p>

      <h3>Should interior designers calculate markup before or after VAT?</h3>
      <p>
        VAT-registered designers should apply markup to the supplier price excluding VAT, then add 15% VAT. Designers who are not VAT registered should treat the VAT they pay suppliers as part of their cost, and must not add VAT to their selling price.
      </p>

      <h3>How do I convert markup to margin?</h3>
      <p>
        Margin = markup ÷ (1 + markup). For example, a 25% markup is 0.25 ÷ 1.25 = 20% margin.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Let the maths take care of itself.</p>
        <p className="cta-body">QuotingHub applies your supplier markups, VAT and design fees on every quote. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
