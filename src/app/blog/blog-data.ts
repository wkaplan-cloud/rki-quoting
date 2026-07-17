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
import QuotingHubForSA from './posts/quotinghub-for-south-african-interior-designers'
import HouzzProVsQuotingHub from './posts/houzz-pro-vs-quotinghub-south-africa'
import DesignFilesVsQuotingHub from './posts/designfiles-vs-quotinghub-south-africa'
import ProgramaAlternatives from './posts/programa-alternatives-south-africa'
import HowToInvoiceClients from './posts/how-to-invoice-clients-interior-design-south-africa'
import InvoiceTemplate from './posts/interior-design-invoice-template-south-africa'
import ContractTemplate from './posts/interior-design-contract-template-south-africa'
import TradeAccounts from './posts/how-to-open-trade-accounts-with-sa-furniture-suppliers'
import BestSuppliers from './posts/best-fabric-and-furniture-suppliers-for-interior-designers-south-africa'
import SupplierLeadTimes from './posts/how-to-manage-supplier-lead-times-south-africa'
import IndustryStatistics from './posts/south-african-interior-design-industry-statistics-2026'
import InteriorDesignCourses from './posts/interior-design-courses-south-africa'

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
    slug: 'quotinghub-for-south-african-interior-designers',
    title: 'Why QuotingHub Is the Quoting Platform Built for South African Interior Designers',
    description: 'Excel breaks. Generic tools don\'t understand VAT, ZAR, or how local suppliers actually work. QuotingHub does — and that\'s why it has quietly become the most trusted quoting system in the South African design industry.',
    date: '2026-05-11',
    category: 'Software Reviews',
    readTime: 5,
    content: QuotingHubForSA,
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
  {
    slug: 'houzz-pro-vs-quotinghub-south-africa',
    title: 'Houzz Pro vs QuotingHub: Which Is Better for South African Interior Designers?',
    description: 'An honest comparison of Houzz Pro and QuotingHub for SA studios — features, USD vs ZAR pricing, VAT handling, lead generation, and which to choose.',
    date: '2026-07-17',
    category: 'Software Reviews',
    readTime: 7,
    content: HouzzProVsQuotingHub,
    faqs: [
      { q: 'Does Houzz Pro work in South Africa?', a: 'Yes — Houzz Pro can be used by South African designers, but you must manually configure currency and tax settings, the subscription is billed in US dollars, and the Houzz consumer marketplace that drives its lead-generation value has a much smaller audience in South Africa than in the US.' },
      { q: 'Is Houzz Pro more expensive than QuotingHub?', a: 'Generally yes for SA studios. Houzz Pro is billed in USD — typically the equivalent of roughly R1,200–R2,700+ per month depending on plan and exchange rate — while QuotingHub starts at R699/month billed in rands, so the cost never moves with the currency.' },
      { q: 'Can I use Houzz Pro and QuotingHub together?', a: 'Yes — some studios use a visual platform for presentations and QuotingHub for quoting, invoicing, and supplier purchase orders. QuotingHub focuses on the commercial workflow, so it pairs cleanly with whatever presentation or design tool you prefer.' },
    ],
  },
  {
    slug: 'designfiles-vs-quotinghub-south-africa',
    title: 'DesignFiles vs QuotingHub: Which Should South African Designers Choose?',
    description: 'DesignFiles is built for e-design boards and presentations; QuotingHub is built for SA quoting, VAT, and supplier purchase orders. Here is how to choose between them.',
    date: '2026-07-17',
    category: 'Software Reviews',
    readTime: 6,
    content: DesignFilesVsQuotingHub,
    faqs: [
      { q: 'Is DesignFiles available in South Africa?', a: 'Yes — DesignFiles is cloud-based and works anywhere. The practical limitations for SA designers are USD billing, US-style invoicing conventions, no native 15% VAT handling, and product sourcing built around international online retailers rather than SA trade suppliers.' },
      { q: 'Which is cheaper — DesignFiles or QuotingHub?', a: 'Entry pricing is broadly comparable, but DesignFiles is billed in US dollars so the cost moves with the exchange rate, while QuotingHub is R699–R2,499/month in ZAR. The bigger question is fit: DesignFiles serves the e-design model, QuotingHub serves the full-service SA studio model of quotes, VAT, deposits, and supplier purchase orders.' },
      { q: 'Can QuotingHub create design boards?', a: 'No — QuotingHub deliberately focuses on quoting, invoicing, purchase orders, and supplier management. Studios that need presentation boards pair QuotingHub with a visual design tool of their choice.' },
    ],
  },
  {
    slug: 'programa-alternatives-south-africa',
    title: 'The Best Programa Alternatives for South African Interior Designers (2026)',
    description: 'Six serious Programa alternatives for SA studios — QuotingHub, Houzz Pro, DesignFiles, Mydoma, Studio Designer, and spreadsheets — compared for SA fit, VAT, and cost.',
    date: '2026-07-17',
    category: 'Software Reviews',
    readTime: 6,
    content: ProgramaAlternatives,
    faqs: [
      { q: 'What is the best Programa alternative for South African designers?', a: 'For most SA studios, QuotingHub — it is built specifically for South Africa, with ZAR pricing, native 15% VAT, SA supplier purchase order workflows, and Sage Business Cloud Accounting integration. International alternatives like Houzz Pro and Mydoma are viable if you specifically need their visual or client portal features and accept USD billing.' },
      { q: 'Why do SA designers switch away from Programa?', a: 'The most common reasons are AUD billing that fluctuates with the exchange rate, no native South African VAT configuration, an internationally focused product library, and paying for FF&E specification features when the studio\'s daily need is quoting, invoicing, and purchase orders.' },
      { q: 'Can I switch from Programa mid-project?', a: 'Yes — most studios finish in-flight projects in the old tool and start new projects in the new one rather than migrating historical data. QuotingHub setup typically takes 1–2 hours: logo, VAT details, and your most-used supplier price lists.' },
    ],
  },
  {
    slug: 'how-to-invoice-clients-interior-design-south-africa',
    title: 'How to Invoice Clients as an Interior Designer in South Africa',
    description: 'The full invoicing workflow for SA design studios — deposit, progress, and final invoices, SARS tax invoice requirements, VAT on deposits, payment terms, and chasing late payers.',
    date: '2026-07-17',
    category: 'Business Guides',
    readTime: 7,
    content: HowToInvoiceClients,
    faqs: [
      { q: 'When should an interior designer invoice the client?', a: 'Immediately at each trigger point: the deposit invoice the moment the quotation is accepted, progress invoices when the agreed milestone occurs, and the final invoice at practical completion. Same-day invoicing at each trigger is the single best habit for studio cash flow.' },
      { q: 'Do interior designers charge VAT on deposit invoices in South Africa?', a: 'If the designer is VAT-registered, yes — under SA VAT law a deposit creates a tax point when received, so the VAT portion is due to SARS in the period the deposit is received, not when the project completes. VAT must be shown separately on the deposit invoice.' },
      { q: 'What payment terms should an interior designer give clients?', a: 'Deposit payable immediately on acceptance and before any supplier orders are placed, and final invoices at 7 days for residential clients or up to 30 days for commercial clients. State the terms on the quotation, the contract, and the invoice itself.' },
      { q: 'What must a South African tax invoice include?', a: 'For VAT-registered studios: the words "Tax Invoice", the supplier\'s name, address, and VAT number, the client\'s details, a unique invoice number and date, a description of goods or services with quantities and prices, VAT at 15% shown separately, and the total payable.' },
    ],
  },
  {
    slug: 'interior-design-invoice-template-south-africa',
    title: 'Interior Design Invoice Template for South Africa: What It Must Include',
    description: 'The eight sections every SA interior design invoice needs — SARS tax invoice fields, deposit vs final invoices, VAT lines, banking details, and the mistakes that slow payment.',
    date: '2026-07-17',
    category: 'Templates & Tools',
    readTime: 6,
    content: InvoiceTemplate,
    faqs: [
      { q: 'What must an interior design invoice include in South Africa?', a: 'For VAT-registered studios: the words "Tax Invoice", your business details and VAT number, the client\'s details, a unique sequential invoice number and date, itemised descriptions with quantities and prices, VAT at 15% as a separate line, the total payable, plus banking details and payment terms.' },
      { q: 'Do non-VAT-registered designers issue tax invoices?', a: 'No — a designer who is not VAT registered issues a standard invoice with no VAT line and no "Tax Invoice" wording. Charging VAT without being registered is unlawful in South Africa. Registration becomes compulsory once taxable turnover exceeds R1 million in any 12-month period.' },
      { q: 'Is there a free invoice template for South African interior designers?', a: 'Yes — QuotingHub\'s 30-day free trial includes full invoicing with SA-compliant formatting, sequential numbering, deposit handling, and automatic 15% VAT, and can be used to issue real invoices before paying anything. No credit card is required.' },
    ],
  },
  {
    slug: 'interior-design-contract-template-south-africa',
    title: 'Interior Design Contract Template for South Africa: The Clauses You Need',
    description: 'The ten clauses every SA interior design contract should contain — scope, fees, deposits, variations, custom items, lead times, cancellation, IP, and disputes.',
    date: '2026-07-17',
    category: 'Templates & Tools',
    readTime: 7,
    content: ContractTemplate,
    faqs: [
      { q: 'Does an interior designer legally need a contract in South Africa?', a: 'No law requires one — a signed quotation can create a binding agreement. But a quotation does not cover scope changes, cancellations, custom-item rules, delays, or intellectual property, which is where the real financial risk sits. Any project beyond trivial value deserves a signed design services agreement.' },
      { q: 'What should an interior design contract include in South Africa?', a: 'The core clauses: parties and project definition, scope of services, fees and how procurement is charged, payment terms and deposits, a written-variations clause, non-cancellable custom items, lead times and delays, cancellation and termination, ownership of designs and photography rights, and liability and dispute resolution.' },
      { q: 'Can I use one contract template for every project?', a: 'Yes — a well-drafted base template with project-specific schedules for parties, address, scope, and fees is how most studios work. Have an attorney draft or review the base template once, then reuse it on every project.' },
    ],
  },
  {
    slug: 'how-to-open-trade-accounts-with-sa-furniture-suppliers',
    title: 'How to Open Trade Accounts with South African Furniture & Fabric Suppliers',
    description: 'What SA suppliers look for, the documents you need, typical trade discounts, and a five-step application process for new interior design studios.',
    date: '2026-07-17',
    category: 'Business Guides',
    readTime: 6,
    content: TradeAccounts,
    faqs: [
      { q: 'Can a new interior designer without clients get trade accounts in South Africa?', a: 'Yes — most SA suppliers accept new designers who present professionally: a registered business, a portfolio or credible online presence, and a completed trade application. New studios often start on cash-with-order terms at trade pricing, with credit terms following once a payment history exists.' },
      { q: 'What trade discount do SA suppliers give interior designers?', a: 'Commonly between 10% and 30% off retail depending on the supplier and category, and some trade-only suppliers price exclusively for the trade. Terms are confidential between designer and supplier — always confirm current terms directly.' },
      { q: 'Do I need to be VAT registered to open a trade account in South Africa?', a: 'Usually no — a registered business and evidence you work in the industry is typically enough. A VAT number strengthens the application, and registration becomes compulsory anyway once taxable turnover exceeds R1 million in any 12-month period.' },
    ],
  },
  {
    slug: 'best-fabric-and-furniture-suppliers-for-interior-designers-south-africa',
    title: 'Fabric & Furniture Suppliers South African Interior Designers Should Know',
    description: 'A category-by-category guide to established SA trade suppliers — fabric houses, furniture, lighting, and rugs — and how to build a supplier book for your studio.',
    date: '2026-07-17',
    category: 'Industry Guides',
    readTime: 7,
    content: BestSuppliers,
    faqs: [
      { q: 'Which fabric suppliers do South African interior designers use?', a: 'Names commonly found in SA designer supplier books include Hertex, St Leger & Viney, Home Fabrics, Mavromac & Gatehouse, and The Fabric Library, among others. The right mix depends on market positioning — premium residential studios lean on high-end houses, while volume work needs broader mid-market ranges.' },
      { q: 'How many suppliers should a new interior design studio start with?', a: 'Around 8–12 covering the core categories: two or three fabric houses, two or three furniture sources including at least one local manufacturer for speed, lighting, and rugs. Add specialists as projects demand rather than opening every account on day one.' },
      { q: 'Do SA trade suppliers sell to the public?', a: 'It varies — some are strictly trade-only, others run retail showrooms with separate trade pricing for designers. That split is why trade accounts matter: they give designers access and margin the public does not get.' },
    ],
  },
  {
    slug: 'how-to-manage-supplier-lead-times-south-africa',
    title: 'How to Manage Supplier Lead Times as an Interior Designer in South Africa',
    description: 'Realistic SA lead times for local and imported items, seven rules that keep installations on schedule, and how to handle exchange-rate risk on imports.',
    date: '2026-07-17',
    category: 'Business Guides',
    readTime: 6,
    content: SupplierLeadTimes,
    faqs: [
      { q: 'How long do furniture lead times run in South Africa?', a: 'As working ranges: local in-stock items within days to two weeks; locally made-to-order furniture commonly 4–8 weeks; imported furniture commonly 8–16+ weeks including shipping and customs. Always confirm the current lead time per item in writing at order stage.' },
      { q: 'Should interior designers tell clients the supplier\'s lead time?', a: 'Give clients a buffered date rather than the supplier\'s raw estimate — typically add 20–30%. The buffer absorbs routine slippage in production and shipping, and delivering early builds far more goodwill than explaining a missed promise.' },
      { q: 'Who carries the cost when an imported item is delayed?', a: 'Delay itself usually costs programme time rather than money, and a well-drafted contract makes clear that supplier and shipping delays extend timelines without penalty to the designer. Exchange-rate movement on unpaid imports is separate and should be addressed explicitly in quote terms or the contract.' },
    ],
  },
  {
    slug: 'south-african-interior-design-industry-statistics-2026',
    title: 'South African Interior Design Industry: Key Figures & Benchmarks (2026)',
    description: 'The key 2026 numbers for the SA interior design industry in one citable page — hourly rates, markups, deposits, VAT thresholds, IID registration, and studio startup costs.',
    date: '2026-07-17',
    category: 'Industry Guides',
    readTime: 5,
    content: IndustryStatistics,
    faqs: [
      { q: 'How much does an interior designer cost in South Africa in 2026?', a: 'Typical hourly rates run R800–R1,500 for mid-level designers and R1,500–R2,500+ for senior designers, or 10–15% of project budget on a percentage model. Most designers additionally apply a 15–30% markup on items procured for the client, with 20% the most common figure.' },
      { q: 'Is interior design a regulated profession in South Africa?', a: 'No — no licence or registration is legally required to practise interior design in South Africa. The IID (Institute of Interior Design Professions) provides voluntary professional registration, which functions as a credibility signal, particularly for commercial and corporate work.' },
      { q: 'What deposit do interior designers take in South Africa?', a: '50% upfront is the industry standard before any items are ordered, with higher splits such as 60/40 or 70/30 used on projects heavy in custom, non-refundable items.' },
      { q: 'When must an interior designer register for VAT in South Africa?', a: 'Registration is compulsory once taxable turnover exceeds R1 million in any consecutive 12-month period, with registration required within 21 days of crossing the threshold. Voluntary registration is available from R50,000 per year. The VAT rate is 15%.' },
    ],
  },
  {
    slug: 'interior-design-courses-south-africa',
    title: 'Interior Design Courses in South Africa: Universities, Colleges & Short Courses',
    description: 'Where to study interior design in SA — university degrees, private design schools, and short courses — plus what to check on accreditation and IID recognition before enrolling.',
    date: '2026-07-17',
    category: 'Industry Guides',
    readTime: 7,
    content: InteriorDesignCourses,
    faqs: [
      { q: 'Where can I study interior design in South Africa?', a: 'At universities offering interior architecture and design programmes (including the University of Pretoria, University of Johannesburg, TUT, CPUT, and DUT), at established private design schools (including BHC School of Design, Greenside Design Center, Inscape, and Design Time), or through short courses and online programmes. Confirm current offerings and accreditation directly with each institution.' },
      { q: 'How long does it take to qualify as an interior designer in South Africa?', a: 'Full degrees and diplomas run three to four years, certificates typically one year, and short courses weeks to months. IID Professional Interior Designer (PrID) registration additionally requires a recognised qualification plus two or more years of professional experience.' },
      { q: 'Can I work as an interior designer in South Africa without studying?', a: 'Legally yes — the profession is unregulated and many successful decorators built careers on talent and referrals. Formal study matters most for commercial work, corporate tenders, and IID registration; for residential decorating, portfolio and client trust matter more than certificates.' },
    ],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
