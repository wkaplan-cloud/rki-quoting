import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://quotinghub.co.za', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://quotinghub.co.za/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-cape-town', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-johannesburg', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-durban', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/faq', changeFrequency: 'monthly', priority: 0.7 },
  ]
}
