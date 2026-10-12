import Link from 'next/link'

export default function FabricQuantities() {
  return (
    <article className="prose-content">
      <p className="lead">
        Ordering too little fabric means a second cut that may come from a different dye lot. Ordering too much eats your margin. This guide shows how to estimate metres for curtains and cushions, step by step, with a worked example. The allowances below are common workroom rules of thumb, not fixed standards. Your curtain maker or upholsterer should always confirm the final quantity before you order.
      </p>

      <h2>What you need before you start</h2>
      <ul>
        <li><strong>Track or rod width</strong> in metres, measured on site.</li>
        <li><strong>Finished drop:</strong> from the top of the track to where the curtain should end.</li>
        <li><strong>Heading style</strong>, which sets the fullness.</li>
        <li><strong>Fabric usable width.</strong> This is the width between the selvedges, which is often a few centimetres less than the full width on the label.</li>
        <li><strong>Pattern repeat</strong>, if the fabric has one. It is usually listed on the supplier&apos;s spec.</li>
      </ul>

      <h2>Curtains: five steps</h2>

      <h3>1. Choose a fullness</h3>
      <p>
        Fullness is how many times wider the flat fabric is than the track. Typical ranges, which vary by workroom and fabric weight:
      </p>
      <ul>
        <li>Pencil pleat: about 2 to 2.5 times</li>
        <li>Pinch pleat: about 2 to 2.5 times</li>
        <li>Wave or S-fold: about 2 to 2.5 times</li>
        <li>Eyelet: about 1.5 to 2 times</li>
      </ul>

      <h3>2. Work out the total flat width</h3>
      <p>
        Track width × fullness, plus an allowance for side hems, returns and overlaps. Workrooms commonly allow around 15 cm per curtain, but confirm with yours.
      </p>

      <h3>3. Work out how many widths to join</h3>
      <p>
        Total flat width ÷ usable fabric width, rounded up to a whole number. You can&apos;t buy part of a width.
      </p>

      <h3>4. Work out the cut drop</h3>
      <p>
        Finished drop plus allowances for the heading and the hem, commonly around 25 to 30 cm in total. If the fabric has a pattern repeat, round each cut drop up to the next whole repeat so the pattern matches across widths.
      </p>

      <h3>5. Multiply</h3>
      <p>
        Number of widths × cut drop = metres to order. For patterned fabric, add one extra repeat so the first cut can start at the right point in the pattern.
      </p>

      <h2>Worked example</h2>
      <p>
        A pair of pencil-pleat curtains on a 3.0 m track, with a 2.6 m finished drop, in 140 cm-wide fabric. We use 2.5 times fullness, a 30 cm total side allowance and a 30 cm heading and hem allowance.
      </p>
      <ul>
        <li>Flat width: 3.0 m × 2.5 + 0.3 m = <strong>7.8 m</strong></li>
        <li>Widths: 7.8 m ÷ 1.4 m = 5.57, rounded up to <strong>6 widths</strong></li>
        <li>Cut drop: 2.6 m + 0.3 m = <strong>2.9 m</strong></li>
        <li>Plain fabric: 6 × 2.9 m = <strong>17.4 m</strong></li>
      </ul>
      <p>
        <strong>The same curtains in a patterned fabric with a 64 cm repeat:</strong> 2.9 m needs 4.5 repeats, so round up to 5 repeats, making each cut drop 3.2 m. Then 6 × 3.2 m = 19.2 m, plus one extra repeat (0.64 m), which is <strong>19.84 m</strong>. Order 20 m. The pattern adds about 2.4 m.
      </p>

      <h2>Wide-width fabrics</h2>
      <p>
        Many sheers and some curtain fabrics come 280 to 320 cm wide and can be used &quot;railroaded&quot;, turned sideways so the width becomes the drop. If your finished drop plus allowances fits within the fabric width, you buy the flat width as a length with no seams. In the example above, that is 7.8 m instead of 17.4 m. Check the fabric is suitable for railroading first, because some weaves and patterns only work one way.
      </p>

      <h2>Cushions</h2>
      <p>
        For a 45 × 45 cm cushion with a 1.5 cm seam allowance all round, each panel is cut at 48 × 48 cm, and you need a front and a back. From a 140 cm-wide plain fabric:
      </p>
      <ul>
        <li>2 panels fit across the width (96 cm), with 44 cm left over.</li>
        <li>Each 48 cm of length gives 2 panels, so 1 m (2 rows) gives 4 panels, enough for 2 cushions.</li>
        <li>6 cushions need 12 panels: 6 rows × 0.48 m = <strong>2.88 m</strong>. Order 3 m.</li>
      </ul>
      <p>
        Piping, zips, pattern centring and contrast backs all change this. Large motifs centred on each cushion can double the quantity.
      </p>

      <h2>Upholstery</h2>
      <p>
        Upholstery quantities depend so much on the frame, cushion construction, pattern and whether the fabric can be railroaded that a general table is more likely to mislead than help. Ask your upholsterer for a quantity based on the actual piece and the actual fabric, including the pattern repeat, before you quote the client.
      </p>

      <h2>Checklist before you order</h2>
      <ol>
        <li>Use the usable width, not the label width.</li>
        <li>Round widths up to whole numbers, and patterned drops up to whole repeats.</li>
        <li>Confirm the quantity with your workroom in writing.</li>
        <li>Order the whole quantity at once, so it all comes from one dye lot.</li>
        <li>Put the quantity, usable width and repeat on the purchase order. See our <Link href="/blog/purchase-orders-for-interior-designers-south-africa" className="text-[#9A7B4F] hover:underline">purchase order guide</Link>.</li>
      </ol>

      <h2>Fabric in QuotingHub</h2>
      <p>
        In QuotingHub, fabric goes on its own quote line in metres, priced per metre from the supplier&apos;s price list, and it can sit directly under the curtain, chair or sofa it is for. Fabrics from supplier catalogues carry their usable width. When you order, the fabric goes on the fabric supplier&apos;s purchase order, separate from the make-up. See the <Link href="/blog/quotinghub-walkthrough-price-list-to-purchase-orders" className="text-[#9A7B4F] hover:underline">product walkthrough</Link>.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>How many metres of fabric do I need for curtains?</h3>
      <p>
        Multiply the track width by the fullness (about 2 to 2.5 times for pleated headings), add side allowances, divide by the fabric&apos;s usable width and round up to get the number of widths. Multiply that by the finished drop plus about 25 to 30 cm for heading and hem. A 3 m track with a 2.6 m drop in 140 cm plain fabric needs about 17.4 m.
      </p>

      <h3>How does a pattern repeat change the quantity?</h3>
      <p>
        Round each cut drop up to the next whole repeat, then add one extra repeat. In our example, a 64 cm repeat took the order from 17.4 m to about 20 m.
      </p>

      <h3>What is usable fabric width?</h3>
      <p>
        The width between the selvedges that can actually be used in the finished curtain or cover. It is often a few centimetres narrower than the full width on the label.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Quote fabric by the metre.</p>
        <p className="cta-body">QuotingHub puts fabric on its own line, priced from your supplier price lists, and onto the right purchase order. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
