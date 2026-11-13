import Link from 'next/link'

export default function DToolsVsQuotingHubSouthAfrica() {
  return (
    <article className="prose-content">
      <p className="lead">
        D-Tools is the best-known software for AV and smart home system integrators, with a large manufacturer product library and deep design and proposal tools. QuotingHub is built in South Africa for home automation, AV, CCTV, security and networking installers who want quoting, jobs, devices and support contracts in one rand-priced system. Here is how they compare.
      </p>

      <h2>Quick summary</h2>
      <ul>
        <li><strong>Choose D-Tools</strong> if you are a larger integrator doing complex, high-value projects, need detailed system design documentation, and are comfortable paying in US dollars.</li>
        <li><strong>Choose QuotingHub</strong> if you want room-by-room quotes from your own distributor price lists, a device register, handover packs and recurring support billing, priced in rand and pushed to Sage.</li>
      </ul>

      <h2>Pricing</h2>
      <p>
        <strong>D-Tools Cloud</strong> is sold in tiered monthly plans in US dollars, each with a set number of office and field users. At the time of writing its published pricing also lists a one-off setup fee and charges the QuickBooks/Xero integration as a monthly add-on. Check D-Tools&apos; pricing page for current figures.
      </p>
      <p>
        <strong>QuotingHub</strong> is R2,999/month (Installer) or R4,499/month (Installer Pro, adding support contracts and recurring invoices), with up to 20 staff included, Sage included, and a R2,500 once-off setup and training fee. Every plan has a 30-day free trial and no contract.
      </p>

      <h2>Product data</h2>
      <p>
        D-Tools&apos; strength is its large library of manufacturer products. QuotingHub works from the price lists your South African distributors already send you: upload the CSV or Excel file, match the columns, set a markup, and re-import next month&apos;s list to update prices without duplicates. Your quotes reflect the rand prices you actually pay.
      </p>

      <h2>Quoting</h2>
      <p>
        Both build multi-room proposals. QuotingHub quotes room by room with reusable kits (for example a 4-camera CCTV system or a Control4 starter), good/better/best options and optional extras the client chooses online, and shows cost, markup and margin on every line.
      </p>

      <h2>After the install</h2>
      <ul>
        <li><strong>Device register:</strong> QuotingHub records every device on site with serial, MAC, IP, firmware, warranty and encrypted logins, scanned from barcodes on a technician&apos;s phone.</li>
        <li><strong>Handover pack:</strong> a PDF for the client listing what was installed.</li>
        <li><strong>Support contracts:</strong> on Installer Pro, monthly or annual plans invoice automatically, remind you 30 days before renewal, and mark each callout as covered or chargeable.</li>
      </ul>

      <h2>Where D-Tools is stronger</h2>
      <ul>
        <li>A very large manufacturer product library.</li>
        <li>Detailed system design and documentation for complex integration projects.</li>
        <li>A long track record with large integrators worldwide.</li>
      </ul>

      <h2>Verdict</h2>
      <p>
        For a South African installer or small-to-mid integrator, QuotingHub covers quoting, jobs, devices, handover and support billing at a fixed rand price with Sage built in. For a large integrator doing complex design-heavy projects, D-Tools remains the specialist tool.
      </p>
      <p>
        See <Link href="/trades/installer" className="text-[#9A7B4F] hover:underline">QuotingHub for installers</Link>, the guide to <Link href="/blog/best-quoting-software-for-home-automation-cctv-installers-south-africa" className="text-[#9A7B4F] hover:underline">quoting software for home automation, AV and CCTV installers</Link>, or <Link href="/blog/how-to-quote-a-cctv-installation-south-africa" className="text-[#9A7B4F] hover:underline">how to quote a CCTV installation</Link>.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Compare for yourself</p>
        <p className="cta-body">QuotingHub is free for 30 days. No credit card required.</p>
        <Link href="/supplier-portal/register?type=installer" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
