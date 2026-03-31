import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/crm/'],
    },
    sitemap: 'https://orerealestate.ae/sitemap.xml',
  }
}
