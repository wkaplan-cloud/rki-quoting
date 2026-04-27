import type { ComponentType } from 'react'

export type FAQ = { q: string; a: string }

export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readTime: number
  content: ComponentType
  faqs?: FAQ[]
}

import HowToWriteQuotation from './posts/how-to-write-interior-design-quotation-south-africa'
import FeeStructure from './posts/interior-design-fee-structure-south-africa'
import QuotationTemplate from './posts/interior-design-quotation-template-south-africa'
import DesignerVsDecorator from './posts/interior-designer-vs-interior-decorator-south-africa'
import VatGuide from './posts/vat-on-interior-design-services-south-africa'
import BestSoftware from './posts/best-interior-design-software-south-africa'
import WhySpreadsheets from './posts/why-spreadsheets-are-costing-your-interior-design-studio'
import PurchaseOrders from './posts/purchase-orders-for-interior-designers-south-africa'
import HowToStart from './posts/how-to-start-interior-design-business-south-africa'
import ProgramaVsQuotingHub from './posts/programa-vs-quotinghub-south-africa'

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-write-interior-design-quotation-south-africa',
    title: 'How to Write an Interior Design Quotation in South Africa',
    description: 'A step-by-step guide for South African interior designers: what to include, how to structure pricing, VAT rules, deposit terms, and common mistakes to avoid.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 7,
    content: HowToWriteQuotation,
    faqs: [
      { q: 'What should an interior design quotation include in South Africa?', a: 'A South African interior design quotation must include your business details and VAT number, the client and project details, a unique quotation number and date, an itemised line-item breakdown with quantities and unit prices, your markup clearly applied, VAT at 15% shown separately, a deposit amount and terms, the quotation validity period, and a formal acceptance section.' },
      { q: 'How do you calculate VAT on an interior design quotation?', a: 'VAT in South Africa is 15%. Apply it to your subtotal (excluding VAT) to get the VAT amount, then add that to the subtotal for the total. For example: R10,000 subtotal + R1,500 VAT (15%) = R11,500 total. VAT must be shown as a separate line item on any invoice or quotation from a VAT-registered designer.' },
      { q: 'What is a standard deposit for an interior design project in South Africa?', a: 'Most South African interior designers charge a 50% deposit upfront before ordering any items. Some use a 60/40 or 70/30 split depending on the project scope. Never order from suppliers before the deposit clears — custom items from SA suppliers are typically non-refundable.' },
      { q: 'How long should an interior design quotation be valid?', a: 'A 30-day validity period is standard for South African interior design quotations. SA supplier prices can change, particularly for imported goods affected by exchange rates. Some designers extend to 45 or 60 days for large commercial projects where clients need more time for approval.' },
    ],
  },
  {
    slug: 'interior-design-fee-structure-south-africa',
    title: 'Interior Design Fee Structure in South Africa: What to Charge in 2026',
    description: 'The three main fee models for SA interior designers — percentage, flat fee, and hourly — with real 2026 rand figures, markup guidance, and advice on which structure suits your studio.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 8,
    content: FeeStructure,
    faqs: [
      { q: 'How do interior designers charge fees in South Africa?', a: 'South African interior designers typically use one of three fee models: a percentage of the total project budget (commonly 10–15% for residential), a flat project fee agreed upfront, or an hourly rate (typically R800–R2,500/hour depending on experience). Most SA designers also apply a markup of 15–30% on procurement as a separate revenue stream.' },
      { q: 'What is the average hourly rate for an interior designer in South Africa?', a: 'Hourly rates for South African interior designers range from R800–R1,500 for mid-level practitioners to R1,500–R2,500+ for senior or specialist designers in major centres. Junior designers or recent graduates typically charge R400–R800/hour. Rates vary significantly between Cape Town, Johannesburg, and smaller cities.' },
      { q: 'What markup do interior designers charge on procurement in South Africa?', a: 'The standard procurement markup for South African interior designers is 15–30% on top of the supplier net price. A 20% markup is most common. This markup compensates for time spent sourcing, purchasing, and managing delivery, and is separate from any design fee charged for the creative and consultancy work.' },
      { q: 'Should I use an hourly rate or flat fee as an interior designer?', a: 'Use hourly rates when starting out or for projects with undefined scope — it protects you from scope creep. Switch to flat project fees once you have enough historical data to estimate time accurately. Percentage fees work well for large-scale commercial or high-budget residential projects where the fee scales naturally with complexity.' },
    ],
  },
  {
    slug: 'interior-design-quotation-template-south-africa',
    title: 'Free Interior Design Quotation Template for South African Designers',
    description: 'Everything your SA interior design quotation template needs: studio header, VAT, line items, deposit terms, validity, and acceptance — plus the common mistakes to avoid.',
    date: '2026-04-27',
    category: 'Templates & Tools',
    readTime: 6,
    content: QuotationTemplate,
    faqs: [
      { q: 'What does an interior design quotation template need to include for South Africa?', a: 'A South African interior design quotation template needs: your studio header with VAT number, client and project details, a quotation number, date and validity period, an itemised table with descriptions, quantities, unit prices, and line totals, a subtotal, 15% VAT line, total, deposit amount, payment terms, and a client acceptance signature block.' },
      { q: 'Is there a free interior design quotation template for South African designers?', a: 'Yes — QuotingHub provides a quotation template built specifically for South Africa, with 15% VAT pre-configured, ZAR pricing, deposit splits, and branded PDF output. It is available free for 30 days with no credit card required at quotinghub.co.za.' },
      { q: 'Can I use a Word or Excel template for interior design quotes?', a: 'Word and Excel templates work for simple, low-volume quoting but create problems at scale: manual VAT calculations are error-prone, version control on accepted quotes is difficult, and purchase orders must be created separately. Purpose-built software eliminates these risks and produces more professional-looking documents.' },
    ],
  },
  {
    slug: 'interior-designer-vs-interior-decorator-south-africa',
    title: 'Interior Designer vs Interior Decorator in South Africa: What\'s the Difference?',
    description: 'The real difference between interior designers and interior decorators in South Africa — qualifications, IID registration, scope of work, and which professional you need for your project.',
    date: '2026-04-27',
    category: 'Industry Guides',
    readTime: 7,
    content: DesignerVsDecorator,
    faqs: [
      { q: 'What is the difference between an interior designer and an interior decorator in South Africa?', a: 'In South Africa, an interior designer is qualified to work on spatial planning, structural changes, and technical specifications — typically holding a formal design qualification and eligible for IID professional registration. An interior decorator focuses on aesthetic decisions — furniture, finishes, colour, and soft furnishings — without necessarily holding a formal qualification. Neither is legally regulated in SA, but the professional distinction matters for commercial projects.' },
      { q: 'Do you need a qualification to work as an interior designer in South Africa?', a: 'No — there is no legal requirement for a formal qualification to trade as an interior designer or decorator in South Africa, unlike architecture. However, IID (Institute of Interior Design Professions) professional registration, which does require a recognised qualification and experience, is a meaningful signal for commercial clients and corporate tenders.' },
      { q: 'What is the IID in South Africa?', a: 'The IID (Institute of Interior Design Professions) is the professional body for interior designers in South Africa. IID membership is voluntary and offers categories including Interior Decorator, Interior Design Practitioner (IDP), and Professional Interior Designer (PrID). PrID registration requires a recognised qualification, two or more years of professional experience, and passing an IID assessment.' },
    ],
  },
  {
    slug: 'vat-on-interior-design-services-south-africa',
    title: 'VAT on Interior Design Services in South Africa: A Practical Guide',
    description: 'When to register, what rate applies, VAT on deposits, how to issue a tax invoice, and what SA interior designers must know about SARS requirements.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 8,
    content: VatGuide,
    faqs: [
      { q: 'Do interior designers charge VAT in South Africa?', a: 'Interior designers in South Africa must charge VAT at 15% once their taxable turnover exceeds R1 million in any 12-month period. Below that threshold, VAT registration is voluntary (available from R50,000 per year). Both design fees and goods procured on behalf of clients are typically subject to VAT once the designer is VAT-registered.' },
      { q: 'When must an interior designer register for VAT in South Africa?', a: 'VAT registration becomes compulsory in South Africa when your taxable turnover exceeds R1 million in any consecutive 12-month period. You must register within 21 days of crossing this threshold. Voluntary registration is available from R50,000 per year. SARS requires registration before the threshold is reached, not after.' },
      { q: 'How is VAT calculated on an interior design deposit?', a: 'Under South African VAT law, a deposit creates a tax point when received — meaning output VAT is due on the deposit amount in the period it was received, not when the project is completed. A VAT-registered designer receiving a R57,500 deposit (R50,000 + R7,500 VAT) must declare the R7,500 as output VAT in that VAT period.' },
      { q: 'What is a tax invoice for interior design services in South Africa?', a: 'A valid South African tax invoice must include the words "Tax Invoice", the supplier\'s name and VAT registration number, the invoice date and number, a description of goods or services supplied, the quantity and price, the VAT amount as a separate line, and the total including VAT. SARS requires this format for a VAT-registered designer\'s clients to claim input tax.' },
    ],
  },
  {
    slug: 'best-interior-design-software-south-africa',
    title: 'Best Interior Design Software in South Africa (2026)',
    description: 'An honest comparison of the best interior design software for South African studios — QuotingHub, Programa, Houzz Pro, DesignFiles, and more, rated for SA-specific needs.',
    date: '2026-04-27',
    category: 'Software Reviews',
    readTime: 7,
    content: BestSoftware,
    faqs: [
      { q: 'Is there interior design software made specifically for South Africa?', a: 'Yes — QuotingHub is built specifically for South African interior designers. It handles ZAR pricing, 15% VAT auto-calculation, deposit management, and SA supplier purchase orders without any configuration. Most other options — Programa, Houzz Pro, DesignFiles — are built for the US or Australian market and require manual adjustments to work correctly in South Africa.' },
      { q: 'How much does interior design software cost in South Africa?', a: 'QuotingHub starts at R699/month (Solo plan) and R1,499/month (Studio plan), priced in ZAR. International tools like Programa cost the equivalent of approximately R900–R2,500/month after converting from AUD, and Houzz Pro costs approximately R1,200–R2,700/month after converting from USD — with pricing subject to exchange rate fluctuations.' },
      { q: 'Do I need interior design software or is Excel enough?', a: 'Excel works for studios doing 1–2 quotes per month, but creates compounding problems at higher volume: manual VAT formula errors, no PDF output, no purchase order generation, and no version control on accepted quotes. Most South African designers outgrow Excel within their first year of active operation. The tipping point is typically 5–8 quotes per month.' },
      { q: 'Can I use Programa in South Africa?', a: 'Yes — Programa is available to SA designers and is used by a number of studios, particularly for high-end commercial projects. The main drawbacks for SA use are AUD pricing (meaning your subscription cost fluctuates with exchange rates), no native 15% SA VAT configuration, and a product library skewed toward international and Australian brands. For studios focused on quoting and supplier management, QuotingHub is more cost-effective.' },
    ],
  },
  {
    slug: 'why-spreadsheets-are-costing-your-interior-design-studio',
    title: 'Why Spreadsheets Are Costing Your Interior Design Studio Money',
    description: 'Seven ways Excel-based quoting is costing South African interior design studios money — VAT errors, time waste, stale prices, unprofessional presentation, and more.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 6,
    content: WhySpreadsheets,
    faqs: [
      { q: 'Can I keep using Excel for simple interior design quotes?', a: 'For studios doing 1–2 quotes per month, Excel is workable. The problems compound with volume: each additional quote increases the probability of a VAT formula error, version control disputes, and time wasted on manual formatting. Most SA designers find the tipping point is around 5–8 quotes per month, at which point dedicated quoting software pays for itself in time saved alone.' },
      { q: 'How long does it take to set up interior design quoting software?', a: 'QuotingHub takes most South African designers 1–2 hours to set up: uploading a logo, entering VAT details, and importing your most-used supplier price lists. After setup, building a complete client quote typically takes minutes rather than the 1–3 hours required to build one from scratch in Excel.' },
      { q: 'Is interior design quoting software worth it if I am just starting out?', a: 'Yes — the professional presentation alone is worth it for new studios. Your quotation is often the first formal document a potential client receives from you. Purpose-built software ensures it looks polished from project one, with consistent branding, correct VAT, and a professional PDF — regardless of how new your studio is.' },
    ],
  },
  {
    slug: 'purchase-orders-for-interior-designers-south-africa',
    title: 'Purchase Orders for Interior Designers in South Africa: A Complete Guide',
    description: 'What purchase orders are, why SA interior designers need them, what to include, and a five-step process for creating and sending POs to your suppliers.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 7,
    content: PurchaseOrders,
    faqs: [
      { q: 'Is a purchase order legally binding in South Africa?', a: 'A purchase order is an offer to purchase — it becomes legally binding when the supplier accepts it, either in writing or by beginning to fulfil the order. Once accepted, you are obligated to pay for goods supplied in accordance with the PO terms. This is why collecting the client deposit before placing any supplier orders is essential — custom and made-to-order items are typically non-cancellable.' },
      { q: 'Do interior designers need a purchase order for every supplier order?', a: 'Not technically, but practically yes for anything custom, non-returnable, or above a trivial value. For a small off-the-shelf accessory, a PO is overkill. For a custom-made sofa, a bespoke fabric order, or any item above approximately R5,000, a formal PO is essential for error prevention, margin confidentiality, and SARS documentation.' },
      { q: 'What PO number format should interior designers use in South Africa?', a: 'Use a consistent sequential format such as PO-2026-001. Including the year prevents number resets becoming confusing across years. Some studios include a project code: PO-2026-SMITH-003. The key requirement is uniqueness — every PO must have a distinct number for SARS documentation and supplier reconciliation.' },
      { q: 'Can an interior designer use the same document as both a client quote and a supplier purchase order?', a: 'No — they serve different purposes and go to different parties. The client quotation includes your retail prices with markup. The supplier purchase order shows only the supplier\'s net price to you. Using the same document risks exposing your markup to the supplier or client, or sending incorrect pricing to the wrong party.' },
    ],
  },
  {
    slug: 'how-to-start-interior-design-business-south-africa',
    title: 'How to Start an Interior Design Business in South Africa (2026 Guide)',
    description: 'Step-by-step guide to starting an interior design studio in South Africa — CIPC registration, IID membership, SARS, branding, first clients, and the tools you need from day one.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 9,
    content: HowToStart,
    faqs: [
      { q: 'Do you need a qualification to start an interior design business in South Africa?', a: 'No — there is no legal requirement for a formal qualification to trade as an interior designer or decorator in South Africa. Unlike architecture, interior design is not a regulated profession requiring registration to practise. However, IID (Institute of Interior Design Professions) registration, which does require a recognised qualification and experience, is a meaningful professional signal for commercial clients.' },
      { q: 'How much does it cost to start an interior design business in South Africa?', a: 'The minimum viable setup for a South African interior design studio is surprisingly affordable: CIPC company registration costs approximately R500, a professional logo R2,000–R8,000, a basic website R3,000–R10,000 (or DIY on Squarespace), and quoting software from R699/month. A professional studio can be launched for under R20,000 in initial setup costs.' },
      { q: 'Do I need a physical studio space to start an interior design business?', a: 'No — most early-stage South African interior design studios operate from home or shared co-working spaces. A physical studio becomes valuable when you are meeting clients frequently, have employees, or want a showroom for finishes and samples. Many successful SA designers never operate from a dedicated studio space.' },
      { q: 'When should an interior designer register for VAT in South Africa?', a: 'VAT registration becomes compulsory once your taxable turnover exceeds R1 million in any 12-month period. Voluntary registration is available from R50,000 per year. It is advisable to register before hitting the compulsory threshold — retroactive VAT registration is more administratively complex than proactive registration.' },
      { q: 'How should an interior designer price their services when starting out?', a: 'Start with an hourly rate model to understand your true time cost before committing to flat or percentage fees. Track every hour on your first three or four projects. You will quickly learn where your time actually goes — typically more on procurement management and client communication than on design — and can price future projects accordingly.' },
    ],
  },
  {
    slug: 'programa-vs-quotinghub-south-africa',
    title: 'Programa vs QuotingHub: Which Is Better for South African Interior Designers?',
    description: 'An honest comparison of Programa and QuotingHub for South African interior design studios — features, SA-specific fit, pricing in ZAR vs AUD, and which to choose.',
    date: '2026-04-27',
    category: 'Software Reviews',
    readTime: 7,
    content: ProgramaVsQuotingHub,
    faqs: [
      { q: 'Is Programa available in South Africa?', a: 'Yes — Programa is available to South African designers and a number of SA studios use it, particularly for high-end commercial and large residential projects. The main practical considerations for SA use are AUD pricing (meaning subscription costs fluctuate with exchange rates), the need to manually configure settings for 15% South African VAT, and a product library that is internationally focused with limited SA-specific supplier content.' },
      { q: 'Does QuotingHub have a free trial?', a: 'Yes — all QuotingHub plans include a 30-day free trial with no credit card required. During the trial you have access to the full platform, including quote creation, invoicing, supplier management, and purchase order generation. The trial is designed to let SA designers build their first real quote before committing.' },
      { q: 'Can QuotingHub replace my spreadsheet for interior design quoting?', a: 'Yes — QuotingHub is specifically designed to replace the Excel quoting workflow used by most South African interior designers when starting out. It handles VAT automatically, generates branded PDFs, manages supplier price lists, and creates purchase orders directly from accepted client quotes — eliminating the double-entry and version control problems of spreadsheet-based quoting.' },
      { q: 'Does QuotingHub integrate with accounting software?', a: 'QuotingHub integrates with Sage Business Cloud Accounting on the Agency plan. This integration is particularly relevant for South African studios as Sage is among the most widely used accounting platforms for SA SMEs. Xero integration is planned. Programa integrates with Xero and QuickBooks, which are less common among SA SMEs than Sage.' },
    ],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
