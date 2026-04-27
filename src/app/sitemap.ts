import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://quotinghub.co.za', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://quotinghub.co.za/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-cape-town', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-johannesburg', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-durban', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-pretoria', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-port-elizabeth', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-stellenbosch', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-george', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-bloemfontein', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/interior-design-software-east-london', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://quotinghub.co.za/faq', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://quotinghub.co.za/blog', changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/how-to-write-interior-design-quotation-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/interior-design-fee-structure-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/interior-design-quotation-template-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/interior-designer-vs-interior-decorator-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/vat-on-interior-design-services-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/best-interior-design-software-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/why-spreadsheets-are-costing-your-interior-design-studio', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/purchase-orders-for-interior-designers-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/how-to-start-interior-design-business-south-africa', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://quotinghub.co.za/blog/programa-vs-quotinghub-south-africa', changeFrequency: 'monthly', priority: 0.8 },
  ]
}
