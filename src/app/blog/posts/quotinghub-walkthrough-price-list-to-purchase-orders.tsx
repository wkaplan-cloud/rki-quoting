import Link from 'next/link'
import Image from 'next/image'

function Shot({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption: string }) {
  return (
    <figure>
      <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 768px) 100vw, 672px" />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export default function QuotingHubWalkthrough() {
  return (
    <article className="prose-content">
      <p className="lead">
        This walkthrough follows one project through QuotingHub, from a supplier price list to the client quote, the invoice, and the purchase orders sent to each supplier. Every screenshot comes from our demo studio. The client, suppliers and prices are made up, but the screens and documents are the real product. We also cover what QuotingHub does not do, and what differs between plans.
      </p>

      <h2>The example project</h2>
      <p>
        &quot;Sandton Penthouse — Full FF&amp;E&quot; is a residential project with four rooms (living, dining, master bedroom and patio), 16 items from five suppliers, a 20% design fee, and a quote total of R616,811.70 including VAT.
      </p>

      <h2>Step 1: Load your supplier prices</h2>
      <p>
        QuotingHub starts with your suppliers&apos; prices. Under <strong>Price Lists</strong>, click <strong>Import Price List</strong> and upload a CSV with brand, collection, design, colour, SKU and price columns (product ID and image URL are optional, and there is a template to download). You can also add, edit and delete individual items afterwards. This works on every plan and with any supplier.
      </p>
      <Shot
        src="/blog/walkthrough/price-list.jpg"
        alt="A studio's imported fabric price list in QuotingHub, showing designs, colours, SKUs and trade prices"
        width={1600}
        height={1000}
        caption="A studio's own imported price list: 20 fabrics from several suppliers, searchable by design, colour, brand or SKU."
      />
      <p>
        <strong>About catalogues:</strong> QuotingHub also maintains catalogues for a small number of South African suppliers. They are locked by default. Your studio requests access from inside the app and we approve it. For most suppliers, you import their price list yourself.
      </p>

      <h2>Step 2: Build the quote</h2>
      <p>
        Create a project, choose the client, and add line items grouped by room. For each item you set the supplier, quantity and unit, dimensions, finish, delivery address and lead time. When you choose a supplier, its default markup is applied, and you can change it per line. QuotingHub works out the sale price from cost and markup.
      </p>
      <p>
        If the supplier has a linked price list, the item field becomes a search. Type a design or SKU and pick the item, and its price comes onto the line. In the example, the outdoor lounge chair has its fabric (5 m) as a line underneath it, picked from a supplier catalogue.
      </p>
      <Shot
        src="/blog/walkthrough/project-line-items.jpg"
        alt="QuotingHub project screen with line items grouped by room, showing supplier, lead time, cost, markup and sale price"
        width={1600}
        height={1000}
        caption="The project screen. Status steps across the top track the job from quote sent to delivered and installed."
      />
      <p>
        <strong>How prices behave once they are on a quote:</strong> they stay fixed. QuotingHub does not reprice a quote by itself. When you re-import a price list, items you add from then on use the new prices, and lines already on a quote keep what you quoted. For items from the automatically synced catalogue, a line is flagged &quot;Price updated&quot; if the supplier&apos;s price has changed since you added it, so you can decide before sending.
      </p>

      <h2>Step 3: Send the quote to the client</h2>
      <p>
        Choose <strong>Download → Quote PDF</strong> to save it, or <strong>Email → Email to Client</strong> to send it. The email attaches the PDF and includes Approve and Decline buttons. The client&apos;s response is logged on the project, alongside a history of every email sent.
      </p>
      <Shot
        src="/blog/walkthrough/quote-pdf.jpg"
        alt="Branded QuotingHub quotation PDF listing items by room with quantities, sale prices and totals"
        width={1100}
        height={1554}
        caption="The client quote, branded with the studio's logo and details. Clients see sale prices only, never cost or markup."
      />
      <p>
        The second page carries the totals (subtotal, design fee, 15% VAT and the deposit due), your banking details, terms and conditions, payment terms and an acceptance block. The deposit percentage comes from your studio settings; this studio uses 60%.
      </p>

      <h2>Step 4: Invoice the client</h2>
      <p>
        Once the client approves, the same project produces the invoice: <strong>Download → Invoice PDF</strong> or <strong>Email → Email to Client</strong>. It uses the same line items and branding, so nothing is retyped. Mark <strong>Deposit Received</strong> and <strong>Paid in Full</strong> on the status steps as payments come in. On the Agency plan, invoices can also be pushed to Sage Business Cloud Accounting.
      </p>

      <h2>Step 5: Order from each supplier</h2>
      <p>
        From the same project, QuotingHub generates one purchase order per supplier, containing only that supplier&apos;s items, at your cost price, with lead times and VAT. Download them, or use <strong>Email → Email to Suppliers</strong> to send each supplier their own order.
      </p>
      <Shot
        src="/blog/walkthrough/purchase-order-pdf.jpg"
        alt="QuotingHub purchase order PDF for one supplier with items, lead times, cost prices and VAT"
        width={1100}
        height={1554}
        caption="The purchase order for the furniture maker: four items across two rooms, at cost, with a PO number to quote on delivery notes."
      />

      <h2>What QuotingHub does not do</h2>
      <ul>
        <li><strong>No live repricing.</strong> Prices change when you re-import a list or a catalogue is updated, and quotes already issued stay as quoted.</li>
        <li><strong>No open catalogue of every brand.</strong> A small number of supplier catalogues are available on request; everything else comes from lists you import.</li>
        <li><strong>No specification platform.</strong> There are no FF&amp;E schedules, spec sheets or mood boards on the current plans. QuotingHub covers quoting, invoicing and ordering.</li>
        <li><strong>Not accounting software.</strong> It produces invoices but does not keep your books. Sage integration is on the Agency plan only.</li>
      </ul>

      <h2>What differs between plans</h2>
      <p>
        Everything in this walkthrough (price lists, quotes, invoices, purchase orders and emailing) is on every plan, including Solo at R699/month. Studio (R1,499/month) adds up to five team members, the Job Cost Sheet, the markup calculator, bulk import tools, profit analytics and an audit log. Agency (R2,499/month) adds up to ten team members, the Sage integration and custom-branded PDFs. See <Link href="/pricing" className="text-[#9A7B4F] hover:underline">pricing</Link> for the full list.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Try it on your own project.</p>
        <p className="cta-body">Import one supplier price list and build your next quote in QuotingHub. Free for 30 days, no credit card required.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
