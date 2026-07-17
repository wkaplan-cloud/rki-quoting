import Link from 'next/link'

export default function BestSuppliers() {
  return (
    <article className="prose-content">
      <p className="lead">
        Every South African design studio is built on its supplier book. The right mix of fabric houses, furniture makers, lighting suppliers, and rug sources determines what you can offer clients, your lead times, and a meaningful share of your margin. Here is a guide to the well-established trade suppliers SA designers commonly work with, by category — and how to build your own supplier book properly.
      </p>

      <p>
        <em>A note on this list: these are established names widely used in the SA design trade, listed alphabetically within category. QuotingHub is not affiliated with any of them, terms change, and inclusion is not an endorsement — always confirm current trade terms, pricing, and lead times directly with each supplier.</em>
      </p>

      <h2>Fabric and wallpaper houses</h2>
      <ul>
        <li><strong>Hertex</strong> — one of SA&apos;s largest fabric and wallpaper houses, with showrooms in the major centres and a wide range from decorating basics to premium collections, plus the Hertex Haus homeware arm.</li>
        <li><strong>Home Fabrics</strong> — a major trade fabric and wallcovering distributor with an extensive local and international range, long established in the SA trade.</li>
        <li><strong>Mavromac &amp; Gatehouse</strong> — known for sophisticated fabric collections and representing notable international mills to the SA trade.</li>
        <li><strong>St Leger &amp; Viney</strong> — a premium fabric and wallpaper house representing well-known international brands alongside local ranges; a staple of high-end SA residential work.</li>
        <li><strong>The Fabric Library (Twinbru)</strong> — trade fabric supplier with a broad, well-organised range spanning upholstery and curtaining across price points.</li>
      </ul>

      <h2>Furniture</h2>
      <ul>
        <li><strong>Block &amp; Chisel</strong> — classic and contemporary furniture with a strong decorator following and trade programme.</li>
        <li><strong>Casarredo</strong> — importer of premium European and Italian furniture brands, used widely on high-end residential and commercial projects.</li>
        <li><strong>Halogen International</strong> — contemporary furniture and lighting for residential and hospitality projects, a familiar name on SA designer specifications.</li>
        <li><strong>Incanda</strong> — locally made solid-wood and upholstered furniture with a distinctive SA character.</li>
        <li><strong>Vogel</strong> — SA-designed and manufactured contemporary furniture, popular where clients want local design and manufacture.</li>
      </ul>

      <h2>Lighting</h2>
      <ul>
        <li><strong>Eurolux</strong> — large-scale lighting importer and distributor covering decorative and technical lighting.</li>
        <li><strong>K. Light Import</strong> — one of SA&apos;s biggest decorative lighting importers, with a wide trade range.</li>
        <li><strong>Spazio</strong> — decorative and architectural lighting importer known for contemporary European-style collections.</li>
      </ul>

      <h2>Rugs and flooring</h2>
      <ul>
        <li><strong>Airloom</strong> — rugs and carpets spanning ready-made collections and custom work, a common designer specification.</li>
        <li><strong>Gonsenhausers Fine Rugs</strong> — long-established fine and custom rug specialist.</li>
      </ul>

      <h2>How to choose which suppliers go in your book</h2>
      <ul>
        <li><strong>Match your positioning.</strong> A studio doing premium residential work needs the top-end fabric houses; a studio doing volume rental turnovers needs reliable mid-market suppliers with stock on hand.</li>
        <li><strong>Weigh lead times as heavily as price.</strong> A beautiful imported piece with a four-month lead time can hold an entire installation hostage. Build a mix of import and local-manufacture suppliers so you always have a faster option. Our <Link href="/blog/how-to-manage-supplier-lead-times-south-africa" className="text-[#9A7B4F] hover:underline">lead time guide</Link> covers this in detail.</li>
        <li><strong>Open accounts before you need them.</strong> Applying for a trade account mid-project, with a client waiting, is the worst time. Set up your core accounts early — here is <Link href="/blog/how-to-open-trade-accounts-with-sa-furniture-suppliers" className="text-[#9A7B4F] hover:underline">how to open SA trade accounts</Link>.</li>
        <li><strong>Track supplier performance.</strong> After a few projects you will know who delivers on time, who communicates, and who quietly substitutes. Keep notes — your supplier book is proprietary studio knowledge.</li>
      </ul>

      <h2>Managing a growing supplier book</h2>
      <p>
        Once you hold accounts with ten or more suppliers, the admin becomes real: price lists in different formats arriving by email, different lead times, different payment terms, and a purchase order per supplier on every project. This is precisely the workflow QuotingHub manages — supplier price lists loaded centrally, client quotes built from them with your markup applied, and per-supplier purchase orders generated from the accepted quote showing only net trade prices. The <Link href="/blog/purchase-orders-for-interior-designers-south-africa" className="text-[#9A7B4F] hover:underline">purchase order guide</Link> shows the full flow.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>Which fabric suppliers do South African interior designers use?</h3>
      <p>
        The names most commonly found in SA designer supplier books include Hertex, St Leger &amp; Viney, Home Fabrics, Mavromac &amp; Gatehouse, and The Fabric Library, among others. The right mix depends on your market positioning — premium residential studios lean on the high-end houses, while volume work needs broader mid-market ranges.
      </p>

      <h3>Do these suppliers sell to the public?</h3>
      <p>
        It varies — some are strictly trade-only, others have retail showrooms with separate trade pricing for designers. This split is exactly why holding trade accounts matters: it gives you access and margin the public does not get.
      </p>

      <h3>How many suppliers should a new studio start with?</h3>
      <p>
        Around 8–12 covering your core categories: two or three fabric houses, two or three furniture sources (at least one local manufacturer for speed), lighting, and rugs. Add specialists as projects demand rather than opening every account on day one.
      </p>

      <div className="cta-block">
        <p className="cta-heading">One system for every supplier.</p>
        <p className="cta-body">Load your supplier price lists into QuotingHub, quote clients with your markup applied, and generate per-supplier POs automatically. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
