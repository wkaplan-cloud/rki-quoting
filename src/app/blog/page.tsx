import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { blogPosts } from './blog-data'

export const metadata: Metadata = {
  title: 'Blog — Interior Design Business Guides for South Africa',
  description: 'Practical guides for South African interior designers: quoting, pricing, VAT, invoicing, purchase orders, and running a more profitable studio.',
  alternates: { canonical: 'https://quotinghub.co.za/blog' },
  openGraph: {
    title: 'Blog — QuotingHub',
    description: 'Practical guides for South African interior designers on quoting, pricing, VAT, and running a more profitable studio.',
    url: 'https://quotinghub.co.za/blog',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

export default function BlogIndexPage() {
  const sorted = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 pt-10 sm:pt-16 pb-24">

        <div className="mb-12">
          <p className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-3">QuotingHub Blog</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#1A1A18] tracking-tight mb-4">
            Run a better studio.
          </h1>
          <p className="text-[#8A877F] text-lg leading-relaxed max-w-xl">
            Practical guides for South African interior designers on quoting, pricing, VAT, and winning more projects.
          </p>
        </div>

        <div className="space-y-px">
          {sorted.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block border border-[#D8D3C8] rounded-2xl p-6 sm:p-8 bg-white hover:border-[#9A7B4F] transition-colors mb-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-wider">
                  {post.category}
                </span>
                <span className="text-xs text-[#C4BFB5]">·</span>
                <span className="text-xs text-[#8A877F]">{post.readTime} min read</span>
                <span className="text-xs text-[#C4BFB5]">·</span>
                <span className="text-xs text-[#8A877F]">
                  {new Date(post.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl text-[#1A1A18] mb-2 group-hover:text-[#9A7B4F] transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-[#8A877F] leading-relaxed">{post.description}</p>
              <p className="mt-4 text-sm font-medium text-[#9A7B4F]">Read article →</p>
            </Link>
          ))}
        </div>

      </div>
    </PublicLayout>
  )
}
