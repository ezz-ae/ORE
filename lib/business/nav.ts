/**
 * The business site's map — one source of truth for the header, the footer,
 * the in-page "next" links and the sitemap. A page that exists but appears in
 * no nav is a page nobody reads, so every route lives here or not at all.
 */

export interface NavItem {
  href: string
  label: string
  /** One line, plain, shown in the mega-menu under the label. */
  blurb: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const PRODUCTS: NavItem[] = [
  {
    href: '/business/lead-machine',
    label: 'Lead Machine',
    blurb: 'The complete system, on your own address, for a company and its agents.',
  },
  {
    href: '/business/listing-to-landing',
    label: 'Listing-to-Landing',
    blurb: 'Your public website and inventory network, with the management desk behind it.',
  },
  {
    href: '/business/meta-for-realtors',
    label: 'Meta for Realtors',
    blurb: 'Meta advertising run properly, for one agent, without a marketing team.',
  },
]

export const PLATFORM: NavItem[] = [
  {
    href: '/business/platform/inventory',
    label: 'Inventory',
    blurb: 'Every project and unit, scored for whether it is fit to advertise.',
  },
  {
    href: '/business/platform/advertising',
    label: 'Advertising',
    blurb: 'Meta and Google campaigns, with hard limits on what can spend money.',
  },
  {
    href: '/business/platform/landing-pages',
    label: 'Landing pages',
    blurb: 'A page per property, and a gate that blocks weak ones from going live.',
  },
  {
    href: '/business/platform/creative',
    label: 'Creative',
    blurb: 'Ad sets, video and brochures produced from the listing you already have.',
  },
  {
    href: '/business/platform/crm',
    label: 'CRM',
    blurb: 'Where the lead lands, who owns it, and what happens in the first hour.',
  },
  {
    href: '/business/platform/intelligence',
    label: 'Intelligence',
    blurb: 'What the assistant reads, what it may act on, and what it is refused.',
  },
  {
    href: '/business/platform/analytics',
    label: 'Analytics & finance',
    blurb: 'Spend, pipeline, commission and the report you send upstairs.',
  },
]

export const COMPANY: NavItem[] = [
  {
    href: '/business/how-it-works',
    label: 'How it works',
    blurb: 'The full path from a listing to a closed deal, in order.',
  },
  {
    href: '/business/security',
    label: 'Security & control',
    blurb: 'Roles, tenant isolation, and the checks that run before any release.',
  },
  {
    href: '/business/pricing',
    label: 'Plans',
    blurb: 'What each product costs to run and what is included.',
  },
  {
    href: '/business/getting-started',
    label: 'Getting started',
    blurb: 'What the first thirty days look like, week by week.',
  },
]

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Products', items: PRODUCTS },
  { label: 'Platform', items: PLATFORM },
  { label: 'Company', items: COMPANY },
]

/** Every business route, for the sitemap and for link checking. */
export const ALL_BUSINESS_ROUTES: string[] = [
  '/business',
  ...PRODUCTS.map((i) => i.href),
  ...PLATFORM.map((i) => i.href),
  ...COMPANY.map((i) => i.href),
]
