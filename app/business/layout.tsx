/**
 * entrestate.com/business — the platform site.
 *
 * WHERE THIS IS ALLOWED TO RENDER. One rule is absolute: a tenant's own
 * instance ({broker}.entrestate.com) must contain zero vendor wording, so this
 * whole tree 404s there. On any non-tenant host it renders, and it is marked
 * noindex unless the deployment is actually the SaaS one — that way the pages
 * can be reviewed on a preview deployment without the vendor's marketing ever
 * being indexed against a client's own domain.
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { SAAS_TENANCY, tenantSubdomainFromHost } from '@/lib/tenancy/config'
import { BusinessHeader, BusinessFooter } from '@/components/business/shell'

export const metadata: Metadata = {
  title: {
    default: 'Entrestate for Business — software for real-estate companies',
    template: '%s — Entrestate for Business',
  },
  description:
    'The operating system real-estate companies in the UAE run on: inventory, advertising, landing pages, CRM and reporting in one place.',
  robots: SAAS_TENANCY ? undefined : { index: false, follow: false },
}

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get('host')
  // Inside a tenant's instance this site does not exist.
  if (tenantSubdomainFromHost(host)) notFound()

  return (
    <div className="min-h-screen bg-[#07090C] font-sans antialiased [color-scheme:dark] selection:bg-[#D4AF37]/25">
      <BusinessHeader />
      <main>{children}</main>
      <BusinessFooter />
    </div>
  )
}
