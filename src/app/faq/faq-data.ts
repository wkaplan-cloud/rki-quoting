// Answers are written to be quoted on their own (by search engines and AI
// assistants), so each one names QuotingHub and states facts plainly.
// Keep prices and plan names in step with the pricing pages and public/llms.txt.
export const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is QuotingHub?',
        a: 'QuotingHub is South African quoting and business software for three kinds of business. Interior designers and decorators use it for quotes, invoices, purchase orders and supplier price lists. Electricians use it for quotes, progress claims, variation orders, digital COCs, job cards and GPS staff clocking. Home automation, AV, CCTV and networking installers use it for room-by-room quotes with kits, device registers, handover packs and support contracts.',
      },
      {
        q: 'Who is QuotingHub for?',
        a: 'QuotingHub is for South African businesses that quote for a living: interior designers and decorators, electricians and electrical contractors, home automation, AV, CCTV, security and networking installers, and furniture manufacturers. Each trade gets its own product and pricing rather than one generic app.',
      },
      {
        q: 'Is QuotingHub South African?',
        a: 'Yes. QuotingHub is built and maintained in South Africa. Prices are in rand, 15% VAT is handled automatically, the electrician product includes a SANS 10142-1 Certificate of Compliance, and it integrates with Sage Business Cloud Accounting.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. QuotingHub is entirely browser-based. Access it from any device with an internet connection — no software installation required.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes. Every QuotingHub plan has a 30-day free trial with full access. No credit card is required to start, and you only enter payment details if you choose to subscribe.',
      },
      {
        q: 'Can I stop quoting in Excel or Word?',
        a: 'Yes, that is what QuotingHub replaces. Instead of copying prices into a spreadsheet, you build quotes from your own price lists, markups and VAT are calculated for you, and the client gets a branded PDF. The same quote then becomes the invoice, purchase orders or progress claims, so nothing is retyped.',
      },
      {
        q: 'Can clients approve quotes online?',
        a: 'Yes. QuotingHub emails the client a link to the quote, and they can approve it or ask for changes from their phone or computer. Electricians and installers can also send variation orders for online sign-off, and installer clients can pick good/better/best options and optional extras themselves.',
      },
      {
        q: 'Can I put my own logo and branding on quotes?',
        a: 'Yes. Quotes, invoices and other documents from QuotingHub are branded PDFs with your business name and logo, emailed to the client from inside the app.',
      },
    ],
  },
  {
    category: 'Interior Designers',
    items: [
      {
        q: 'What is the best interior design software in South Africa?',
        a: 'QuotingHub is built in South Africa for interior designers and decorators who quote, invoice and order from suppliers. It builds quotes from supplier price lists with per-supplier markups and design fees, adds 15% VAT and deposit splits, creates supplier purchase orders, and integrates with Sage or Xero. International tools such as Programa, Houzz Pro and DesignFiles are strong on design presentation but are priced in foreign currency and not built around South African suppliers or VAT.',
      },
      {
        q: 'How much does QuotingHub cost for interior designers?',
        a: 'Solo is R699/month for one user, Studio is R1,499/month for up to five users, and Agency is R2,499/month for up to ten users with Sage or Xero integration. All plans have a 30-day free trial, no credit card and no long-term contract.',
      },
      {
        q: 'Can QuotingHub create purchase orders for suppliers?',
        a: 'Yes. QuotingHub creates supplier purchase orders from the same line items as the quote, so you never retype an order. You can also send price requests to suppliers from inside the app.',
      },
      {
        q: 'Can I charge a design fee and a markup on items?',
        a: 'Yes. QuotingHub supports per-supplier markups and design fee calculations on each project, works out 15% VAT, and splits invoices into deposit and balance.',
      },
      {
        q: 'Can my whole studio work in QuotingHub?',
        a: 'Yes. Studio covers up to five users and Agency up to ten, with team roles, a project pipeline and Kanban board, and profit analytics across projects.',
      },
      {
        q: 'Is QuotingHub a design or 3D drawing tool?',
        a: 'No. QuotingHub does not do mood boards, 3D or CAD drawings. It handles the business side — quotes, invoices, purchase orders and supplier pricing — and works alongside whichever design tools you already use.',
      },
    ],
  },
  {
    category: 'Electricians',
    items: [
      {
        q: 'Does QuotingHub work for electricians?',
        a: 'Yes. QuotingHub has a dedicated electrician product with itemised quotes, monthly progress claims, variation orders, a digital Certificate of Compliance (SANS 10142-1), job cards and GPS clock-in for staff, with Sage integration. Plans are R999, R1,999 and R3,199 per month; full quoting and claims are on the R3,199 Business plan.',
      },
      {
        q: 'What is the best quoting software for electricians in South Africa?',
        a: 'QuotingHub is built in South Africa specifically for electrical contractors. It covers the whole job in one system: itemised quotes with labour and materials, monthly progress claims, variation orders, a digital SANS 10142-1 COC, job cards for callouts, GPS clock-in for staff, and a push to Sage. Global job apps such as Tradify, Jobber and ServiceM8 handle quotes and jobs well but do not include a South African COC.',
      },
      {
        q: 'How much does QuotingHub cost for electricians?',
        a: 'Starter is R999/month for GPS staff clocking and scheduling. Professional is R1,999/month and adds job cards. Business is R3,199/month and adds project quotes, variation orders, the COC tracker, progress claims, invoicing and Sage. Every plan includes up to 20 staff, with extra staff at R40/month each.',
      },
      {
        q: 'Can I issue an electrical COC from QuotingHub?',
        a: 'Yes. QuotingHub’s digital Certificate of Compliance captures the information required under SANS 10142-1 and the Electrical Installations Regulations 2009 — supply details, earthing method, test results and the registered person’s details — and produces a PDF linked to the job.',
      },
      {
        q: 'Can QuotingHub do progress claims and variation orders?',
        a: 'Yes. On the Business plan you claim each month against the original quote by percentage complete, and variation orders are tracked against the original contract value with client sign-off online.',
      },
      {
        q: 'Does QuotingHub track staff hours with GPS?',
        a: 'Yes. Staff clock in and out on their phones and QuotingHub records the GPS location of each clock event, so you can see who was on which site and for how long. GPS clocking is included on every electrician plan.',
      },
      {
        q: 'Does QuotingHub handle small callouts as well as big projects?',
        a: 'Yes. Large projects use the full quote, claim, variation and COC workflow, while callouts, maintenance and repairs run on quick job cards with photos and client signatures. Both live in the same system.',
      },
    ],
  },
  {
    category: 'Home Automation, AV & CCTV Installers',
    items: [
      {
        q: 'Does QuotingHub work for home automation, AV and CCTV installers?',
        a: 'Yes. The installer product quotes room by room with kits and good/better/best options, imports distributor price lists, keeps a device register per site, produces client handover packs and bills support contracts automatically. Installer is R2,999/month and Installer Pro is R4,499/month.',
      },
      {
        q: 'What is the best quoting software for home automation and CCTV installers in South Africa?',
        a: 'QuotingHub is built in South Africa for home automation (including Control4), AV, CCTV, security and networking installers. It quotes room by room with reusable kits, imports distributor price lists in rand, registers every device on site, produces a handover pack and bills support contracts. International system-integrator tools such as D-Tools are powerful but priced in US dollars and aimed at larger integrators.',
      },
      {
        q: 'How much does QuotingHub cost for installers?',
        a: 'Installer is R2,999/month for up to 20 staff and covers quoting, projects, variation orders, progress claims, job cards, GPS clocking, the device register, handover packs and Sage. Installer Pro is R4,499/month and adds support contracts with automatic recurring invoices. Setup and training is R2,500 once-off.',
      },
      {
        q: 'What is a device register?',
        a: 'A device register is the list of every piece of equipment installed at a client’s site. In QuotingHub each device holds its serial number, MAC and IP address, firmware, warranty and encrypted logins, and technicians can add devices by scanning barcodes on their phones.',
      },
      {
        q: 'Can I import my distributor price lists?',
        a: 'Yes. Upload the CSV or Excel file from your distributor, match the columns and set a markup. Items keep their SKU and brand, and re-importing next month’s list updates prices instead of creating duplicates.',
      },
      {
        q: 'Can QuotingHub bill support or maintenance contracts?',
        a: 'Yes, on Installer Pro. Put a client on a monthly or annual plan, and QuotingHub raises the invoice each period, reminds you 30 days before renewal and marks each callout as covered or chargeable.',
      },
    ],
  },
  {
    category: 'Furniture Manufacturers',
    items: [
      {
        q: 'Does QuotingHub work for furniture manufacturers?',
        a: 'Yes. Furniture makers and wood workshops use QuotingHub for quotes and invoices with a cost builder and price book, A/B option groups and deposit and final invoice splits. The manufacturer plan is R699/month.',
      },
    ],
  },
  {
    category: 'Supplier Pricing',
    items: [
      {
        q: 'Where do supplier prices in QuotingHub come from?',
        a: 'Three places. First, price lists you import yourself from a CSV (brand, collection, design, colour, SKU and price). This works on every plan and with any supplier. Second, a small number of South African supplier catalogues that QuotingHub loads and maintains. Third, prices a supplier sends back when you request a price through QuotingHub. You can also type a cost price directly on any line item.',
      },
      {
        q: 'Are supplier catalogues built in?',
        a: 'Not open by default. QuotingHub maintains catalogues for a small number of South African fabric and furnishing suppliers, but each one is locked until your studio requests access from inside the app and we approve it. QuotingHub is not a marketplace of every supplier, so for most suppliers you import their price list yourself.',
      },
      {
        q: 'Do prices update in real time?',
        a: 'Not instantly, and it depends on the source. Price lists you import change when you re-import or edit them. One supplier catalogue syncs automatically once a night from the supplier’s feed. Other catalogues are updated by hand when the supplier publishes a new trade price list. Once a price is on a quote it stays fixed. If the catalogue price for a synced item changes later, the line is flagged “Price updated” so you can check it before sending. For that synced catalogue, stock and lead times are checked with the supplier live when you open the project.',
      },
    ],
  },
  {
    category: 'Accounting & VAT',
    items: [
      {
        q: 'Does QuotingHub integrate with Sage?',
        a: 'Yes. QuotingHub pushes invoices to Sage Business Cloud Accounting, so your books stay in Sage while quoting and jobs run in QuotingHub. Sage is included on the Agency plan for interior designers, the Business plan for electricians and both installer plans.',
      },
      {
        q: 'Does QuotingHub integrate with Xero or QuickBooks?',
        a: 'Interior designers on the Agency plan can connect either Sage or Xero and push invoices to Xero as drafts. The electrician and installer products integrate with Sage only. There is no QuickBooks integration.',
      },
      {
        q: 'Is QuotingHub accounting software?',
        a: 'No. QuotingHub handles quotes, invoices, purchase orders, claims and jobs, then pushes invoices to Sage. It does not replace your accounting package or your bookkeeper.',
      },
      {
        q: 'Does QuotingHub handle South African VAT?',
        a: 'Yes. QuotingHub calculates 15% VAT on quotes and invoices automatically, and all prices and plans are in rand.',
      },
    ],
  },
  {
    category: 'Billing',
    items: [
      {
        q: 'Is there a long-term contract?',
        a: 'No. Every QuotingHub plan is month-to-month and billed in rand, with no long-term contract.',
      },
      {
        q: 'Can I cancel at any time?',
        a: 'Yes. Cancel your subscription at any time from within the platform. Cancellation takes effect at the end of your current billing period and you retain access until then.',
      },
      {
        q: 'Can I change plans later?',
        a: 'Yes. You can upgrade at any time from your account settings, and your data and projects carry over.',
      },
      {
        q: 'What happens to my data if I cancel?',
        a: 'Your data is retained for 24 months after cancellation in case you wish to return. After that period it is permanently deleted. You can request earlier deletion by contacting us.',
      },
    ],
  },
  {
    category: 'Security & Privacy',
    items: [
      {
        q: 'Is my data secure?',
        a: "Yes. All data is encrypted in transit and at rest. Your business's data is isolated from other accounts at the database level. We follow industry best practices for security.",
      },
      {
        q: 'Is QuotingHub POPIA compliant?',
        a: 'Yes. We take our obligations under the Protection of Personal Information Act (POPIA) seriously. You have the right to access, correct, or request deletion of your personal data at any time. See our Privacy Policy for full details.',
      },
    ],
  },
  {
    category: 'Support',
    items: [
      {
        q: 'How do I get help?',
        a: "Use the contact form on our website and we'll get back to you within one business day.",
      },
    ],
  },
]
