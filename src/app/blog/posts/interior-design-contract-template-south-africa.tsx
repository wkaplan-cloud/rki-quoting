import Link from 'next/link'

export default function ContractTemplate() {
  return (
    <article className="prose-content">
      <p className="lead">
        A signed quotation gets many South African designers through small projects — until the first client who disputes scope, cancels a custom sofa order, or refuses the final payment. A proper design services agreement protects you from exactly those moments. Here is what an SA interior design contract should contain, clause by clause, and where designers get burned without one.
      </p>

      <p>
        <em>A note before we start: this is practical industry guidance, not legal advice. Have an attorney review your final contract — one afternoon of legal fees is cheap insurance against a single bad project.</em>
      </p>

      <h2>Why a quotation alone is not enough</h2>
      <p>
        Your quotation defines what you will supply and at what price. It usually says nothing about what happens when things change: the client who adds three rooms mid-project, the supplier who discontinues a fabric, the delivery delayed at port, or the cancellation after custom items were ordered. Those situations are where studios lose real money, and they are governed by your contract — or by nothing.
      </p>

      <h2>The clauses your contract needs</h2>

      <h3>1. Parties and project definition</h3>
      <p>
        Full legal names of your entity and the client, the project address, and a description of the areas covered. Ambiguity about whether the scope included the guest bathroom starts here, so kill it here.
      </p>

      <h3>2. Scope of services</h3>
      <p>
        Spell out what you are providing — concept development, space planning, procurement, installation supervision — and equally what you are not: structural work, quantity surveying, project managing other contractors. Reference the quotation for the itemised supply scope.
      </p>

      <h3>3. Fees and how you charge</h3>
      <p>
        State your fee model — hourly, flat fee, or percentage — and how procurement is charged, including that items are supplied at your quoted prices. Whether you disclose your markup percentage is a business decision, but the contract should state clearly that quoted prices are your selling prices. See our guide to <Link href="/blog/interior-design-fee-structure-south-africa" className="text-[#9A7B4F] hover:underline">SA fee structures</Link> for the models and current rates.
      </p>

      <h3>4. Payment terms and deposits</h3>
      <p>
        Deposit percentage (typically 50%), the rule that no orders are placed before the deposit clears, progress payment triggers, final payment terms, and late-payment interest. This clause should match your quotation terms word for word.
      </p>

      <h3>5. Variations and scope changes</h3>
      <p>
        The most valuable clause in the document: any change to scope is quoted in writing, accepted by the client, and billed — no verbal additions. Scope creep is the quiet killer of design studio margins.
      </p>

      <h3>6. Custom and made-to-order items</h3>
      <p>
        State explicitly that custom, cut (fabric), and made-to-order items are non-cancellable and non-refundable once ordered. This is standard SA supplier practice passed through to the client — and the clause that saves you when a client changes their mind about a bespoke piece already in production.
      </p>

      <h3>7. Lead times and delays</h3>
      <p>
        Lead times are estimates, not guarantees; delays caused by suppliers, shipping, or the client (late decisions, late payments) extend the programme. If you work with imported goods, address exchange-rate movements on unpaid items. Our <Link href="/blog/how-to-manage-supplier-lead-times-south-africa" className="text-[#9A7B4F] hover:underline">lead times guide</Link> covers how to manage this operationally.
      </p>

      <h3>8. Cancellation and termination</h3>
      <p>
        What either party must do to exit: notice period, payment for work done and items ordered, and return of the deposit balance if any. Note that where the Consumer Protection Act applies to a private client, certain cancellation rights may exist regardless of your contract — another reason for attorney review.
      </p>

      <h3>9. Ownership of designs and photography</h3>
      <p>
        Your concepts, drawings, and boards remain your intellectual property until paid for in full, and you retain the right to photograph the completed project for your portfolio (with reasonable privacy accommodations). Designers forget this clause until the first client who refuses a photoshoot.
      </p>

      <h3>10. Liability, insurance, and disputes</h3>
      <p>
        Reasonable limits on your liability (you are not the manufacturer of the goods), a note on professional indemnity insurance if you carry it, and a dispute process — negotiation, then mediation or arbitration, before court.
      </p>

      <h2>How the contract, quotation, and invoices fit together</h2>
      <p>
        The contract is signed once per project and governs the relationship. The quotation defines the supply and pricing and is accepted in writing. Invoices then trace to the quotation. When all three line up, disputes become rare and short. QuotingHub handles the quotation-to-invoice chain — see <Link href="/blog/how-to-write-interior-design-quotation-south-africa" className="text-[#9A7B4F] hover:underline">how to write an SA design quotation</Link> — while your contract sits on top as the legal framework.
      </p>

      <h2>Frequently asked questions</h2>

      <h3>Does an interior designer legally need a contract in South Africa?</h3>
      <p>
        There is no law requiring one — a signed quotation can create a binding agreement. But a quotation does not cover scope changes, cancellations, custom-item rules, delays, or IP, which is where the real financial risk sits. Any project beyond trivial value deserves a signed agreement.
      </p>

      <h3>Can I use one contract template for every project?</h3>
      <p>
        Yes — a well-drafted template with project-specific schedules (parties, address, scope, fees) is exactly how most studios work. Have an attorney draft or review the base template once, then reuse it.
      </p>

      <h3>What deposit should the contract specify?</h3>
      <p>
        50% is the SA standard for residential design projects, with some studios using 60/40 or 70/30 depending on the custom-item proportion. The critical part is the rule attached to it: nothing is ordered until the deposit has cleared.
      </p>

      <div className="cta-block">
        <p className="cta-heading">Get the commercial side airtight too.</p>
        <p className="cta-body">QuotingHub keeps your quotes, invoices, and purchase orders perfectly in sync — so your paperwork always matches what the client signed. Free for 30 days.</p>
        <Link href="/signup" className="cta-button">Start your free trial</Link>
      </div>
    </article>
  )
}
