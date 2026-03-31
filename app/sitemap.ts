import { MetadataRoute } from 'next'
import { getProjectsForGrid, getAreas, getProperties } from '@/lib/entrestate'
import { filterAuthorizedAreas } from '@/lib/utils/authorized'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://orerealestate.ae'

  // Fetch dynamic data
  const projects = await getProjectsForGrid(120)
  const rawAreas = await getAreas()
  const areas = filterAuthorizedAreas(rawAreas)
  const properties = await getProperties(120)

  // Dynamic routes
  const projectUrls = projects.map((project) => ({
    url: `${baseUrl}/projects/${project.slug}`,
    lastModified: new Date(),
  }))

  const areaUrls = areas.map((area) => ({
    url: `${baseUrl}/areas/${area.slug}`,
    lastModified: new Date(),
  }))

  const propertyUrls = properties.map((property) => ({
    url: `${baseUrl}/properties/${property.slug}`,
    lastModified: new Date(),
  }))

  // Static routes
  const staticRoutes = [
    '',
    '/properties',
    '/projects',
    '/areas',
    '/developers',
    '/blog',
    '/about',
    '/contact',
    '/chat',
    '/market',
    '/market/why-dubai',
    '/market/areas',
    '/market/golden-visa',
    '/market/financing',
    '/market/regulations',
    '/tools',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }))

  return [...staticRoutes, ...projectUrls, ...areaUrls, ...propertyUrls]
}
