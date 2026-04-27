import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { blogPosts, getPost } from '../blog-data'

export async function generateStaticParams() {
  return blogPosts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://quotinghub.co.za/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://quotinghub.co.za/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
    publisher: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za', logo: 'https://quotinghub.co.za/logo.png' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://quotinghub.co.za/blog/${post.slug}` },
  }

  const faqSchema = post.faqs && post.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null

  const Content = post.content

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, '\\u003c') }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
        />
      )}

      <div className="max-w-2xl mx-auto px-6 pt-10 sm:pt-16 pb-24">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#8A877F] mb-8">
          <Link href="/blog" className="hover:text-[#9A7B4F] transition-colors">Blog</Link>
          <span>›</span>
          <span className="text-[#9A7B4F] font-medium">{post.category}</span>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-wider">{post.category}</span>
            <span className="text-xs text-[#C4BFB5]">·</span>
            <span className="text-xs text-[#8A877F]">{post.readTime} min read</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1A1A18] tracking-tight leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-[#8A877F] text-lg leading-relaxed mb-4">{post.description}</p>
          <p className="text-xs text-[#C4BFB5]">
            {new Date(post.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </header>

        <hr className="border-[#D8D3C8] mb-10" />

        {/* Post content */}
        <div className="blog-content">
          <Content />
        </div>

        <hr className="border-[#D8D3C8] mt-16 mb-10" />

        {/* Back link */}
        <Link href="/blog" className="text-sm text-[#9A7B4F] hover:underline">
          ← Back to all articles
        </Link>

      </div>
    </PublicLayout>
  )
}
