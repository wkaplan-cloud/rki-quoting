import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Block all bots from the authenticated app and API
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/projects/', '/clients/', '/suppliers/', '/items/', '/settings/', '/admin/', '/import/', '/price-lists/', '/onboarding/', '/set-password/'],
      },
      // Explicitly allow all known AI crawlers on public pages
      { userAgent: 'GPTBot',          allow: '/' },
      { userAgent: 'ChatGPT-User',    allow: '/' },
      { userAgent: 'PerplexityBot',   allow: '/' },
      { userAgent: 'ClaudeBot',       allow: '/' },
      { userAgent: 'anthropic-ai',    allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Amazonbot',       allow: '/' },
      { userAgent: 'Applebot',        allow: '/' },
      { userAgent: 'Bingbot',         allow: '/' },
      { userAgent: 'cohere-ai',       allow: '/' },
    ],
    sitemap: 'https://quotinghub.co.za/sitemap.xml',
  }
}
