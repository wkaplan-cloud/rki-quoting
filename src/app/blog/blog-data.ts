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
]

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
