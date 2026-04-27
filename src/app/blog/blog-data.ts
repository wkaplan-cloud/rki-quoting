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
]

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
