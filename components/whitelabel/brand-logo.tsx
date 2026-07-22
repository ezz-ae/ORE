'use client'

import Image from 'next/image'
import { useBrand } from './brand-provider'

/**
 * The public-site brand mark. Renders:
 *   • the Freehold lockup (known dimensions) in the Freehold product;
 *   • the workspace's uploaded logo in a white-label deployment; or
 *   • a text wordmark of the brand name when a workspace set no logo.
 */
export function BrandLogo({ className }: { className?: string }) {
  const brand = useBrand()

  if (brand.logo === '/freehold-logo.png') {
    return (
      <Image
        src={brand.logo}
        alt={`${brand.company} Properties`}
        width={1042}
        height={417}
        priority
        className={className}
      />
    )
  }

  if (brand.logo) {
    // Uploaded workspace logo — arbitrary dimensions, so size by height via the class.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo} alt={brand.company} className={className} />
  }

  return (
    <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-gold)' }}>
      {brand.company}
    </span>
  )
}
