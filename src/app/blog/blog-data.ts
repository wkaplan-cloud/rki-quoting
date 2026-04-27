import type { ComponentType } from 'react'

export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readTime: number
  content: ComponentType
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
  },
  {
    slug: 'interior-design-fee-structure-south-africa',
    title: 'Interior Design Fee Structure in South Africa: What to Charge in 2026',
    description: 'The three main fee models for SA interior designers — percentage, flat fee, and hourly — with real 2026 rand figures, markup guidance, and advice on which structure suits your studio.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 8,
    content: FeeStructure,
  },
  {
    slug: 'interior-design-quotation-template-south-africa',
    title: 'Free Interior Design Quotation Template for South African Designers',
    description: 'Everything your SA interior design quotation template needs: studio header, VAT, line items, deposit terms, validity, and acceptance — plus the common mistakes to avoid.',
    date: '2026-04-27',
    category: 'Templates & Tools',
    readTime: 6,
    content: QuotationTemplate,
  },
  {
    slug: 'interior-designer-vs-interior-decorator-south-africa',
    title: 'Interior Designer vs Interior Decorator in South Africa: What\'s the Difference?',
    description: 'The real difference between interior designers and interior decorators in South Africa — qualifications, IID registration, scope of work, and which professional you need for your project.',
    date: '2026-04-27',
    category: 'Industry Guides',
    readTime: 7,
    content: DesignerVsDecorator,
  },
  {
    slug: 'vat-on-interior-design-services-south-africa',
    title: 'VAT on Interior Design Services in South Africa: A Practical Guide',
    description: 'When to register, what rate applies, VAT on deposits, how to issue a tax invoice, and what SA interior designers must know about SARS requirements.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 8,
    content: VatGuide,
  },
  {
    slug: 'best-interior-design-software-south-africa',
    title: 'Best Interior Design Software in South Africa (2026)',
    description: 'An honest comparison of the best interior design software for South African studios — QuotingHub, Programa, Houzz Pro, DesignFiles, and more, rated for SA-specific needs.',
    date: '2026-04-27',
    category: 'Software Reviews',
    readTime: 7,
    content: BestSoftware,
  },
  {
    slug: 'why-spreadsheets-are-costing-your-interior-design-studio',
    title: 'Why Spreadsheets Are Costing Your Interior Design Studio Money',
    description: 'Seven ways Excel-based quoting is costing South African interior design studios money — VAT errors, time waste, stale prices, unprofessional presentation, and more.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 6,
    content: WhySpreadsheets,
  },
  {
    slug: 'purchase-orders-for-interior-designers-south-africa',
    title: 'Purchase Orders for Interior Designers in South Africa: A Complete Guide',
    description: 'What purchase orders are, why SA interior designers need them, what to include, and a five-step process for creating and sending POs to your suppliers.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 7,
    content: PurchaseOrders,
  },
  {
    slug: 'how-to-start-interior-design-business-south-africa',
    title: 'How to Start an Interior Design Business in South Africa (2026 Guide)',
    description: 'Step-by-step guide to starting an interior design studio in South Africa — CIPC registration, IID membership, SARS, branding, first clients, and the tools you need from day one.',
    date: '2026-04-27',
    category: 'Business Guides',
    readTime: 9,
    content: HowToStart,
  },
  {
    slug: 'programa-vs-quotinghub-south-africa',
    title: 'Programa vs QuotingHub: Which Is Better for South African Interior Designers?',
    description: 'An honest comparison of Programa and QuotingHub for South African interior design studios — features, SA-specific fit, pricing in ZAR vs AUD, and which to choose.',
    date: '2026-04-27',
    category: 'Software Reviews',
    readTime: 7,
    content: ProgramaVsQuotingHub,
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
